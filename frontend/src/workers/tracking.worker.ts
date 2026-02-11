/**
 * Tracking Web Worker
 * * Runs MediaPipe inference off the main thread to prevent UI blocking.
 * Receives ImageBitmap frames and returns solved tracking data.
 * * Architecture: This worker owns the full tracking pipeline:
 * 1. MediaPipe inference (Face/Hand detection)
 * 2. Geometry solving (FaceSolver)
 * 3. Session management (ID assignment + temporal matching)
 * 4. Smoothing (OneEuroFilter)
 * * The main thread receives clean, final FaceVector data.
 */

import { FilesetResolver, FaceLandmarker, GestureRecognizer } from '@mediapipe/tasks-vision';
import { TrackingWorkerConfig, MainToWorkerMessage, WorkerToMainMessage, WorkerTrackingBufferMessage } from '../types/workerTypes';
import { FaceSolver, SolvedGeometry } from '../lib/tracking/FaceSolver';
import { SessionManager } from '../lib/tracking/SessionManager';
import { RecoveryEngine } from '../lib/tracking/RecoveryEngine';
import { TrackingBuffer } from '../lib/tracking/TrackingBuffer';
import { DetectedHand, GestureType } from '../types/schemas';

// ========================
// Worker State
// ========================

let config: TrackingWorkerConfig | null = null;
let faceLandmarker: FaceLandmarker | null = null;
let gestureRecognizer: GestureRecognizer | null = null;
let recoveryEngine: RecoveryEngine | null = null;
let sessionManager: SessionManager | null = null;
let trackingBuffer: TrackingBuffer | null = null;

// Track if we're currently processing to implement backpressure
let isProcessing = false;

// Optimization state for hand throttling
let frameCount = 0;
let lastDetectedHands: DetectedHand[] = [];

// Timestamp monotonicity guard - MediaPipe requires strictly increasing timestamps
// Timestamp monotonicity guard - MediaPipe requires strictly increasing timestamps
let lastTimestamp = 0;

// ========================
// WebSocket & Trigger State
// ========================

let ws: WebSocket | null = null;
let isWsConnected = false;
let wsReconnectTimer: any = null;

// Trigger State (Debouncing/Holding)
interface TriggerState {
    enterTime: number | null;
    hasTriggered: boolean;
    lastSeenTime: number | null;
}
const triggerStates: Map<string, TriggerState> = new Map();

function connectCompanion() {
    if (ws || !config) return;

    const { host, port } = config.companion;
    const url = `ws://${host}:${port}`;
    console.log(`[TrackingWorker] Connecting to Companion: ${url}`);

    ws = new WebSocket(url);

    ws.onopen = () => {
        console.log('[TrackingWorker] Companion Connected');
        isWsConnected = true;
        self.postMessage({ type: 'COMPANION_STATUS', payload: { isConnected: true } });
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data.toString());
            if (data.type === 'variable_update' || data.type === 'recording_variable_update' || data.type === 'playback_variable_update') {
                // Determine type
                let msgType: 'generic' | 'recording' | 'playback' = 'generic';
                if (data.type === 'recording_variable_update') msgType = 'recording';
                if (data.type === 'playback_variable_update') msgType = 'playback';

                // console.log(`[TrackingWorker] Received Variable (${msgType}):`, data.value);

                const update: WorkerToMainMessage = {
                    type: 'VARIABLE_UPDATE',
                    payload: {
                        messageType: msgType,
                        value: data.value,
                        timestamp: Date.now()
                    }
                };
                self.postMessage(update);
            }
        } catch (e) {
            // console.warn('[TrackingWorker] Failed to parse WS message', e);
        }
    };

    ws.onclose = () => {
        console.log('[TrackingWorker] Companion Disconnected');
        isWsConnected = false;
        self.postMessage({ type: 'COMPANION_STATUS', payload: { isConnected: false } });
        ws = null;
        retryConnection();
    };

    ws.onerror = (err) => {
        // console.error('[TrackingWorker] Companion Error', err);
    };
}

function retryConnection() {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(() => {
        connectCompanion();
    }, 5000);
}

function sendCompanionCommand(page: number, bank: number) {
    if (!ws || !isWsConnected) return;
    ws.send(`BANK-PRESS ${page} ${bank}`);
}

/**
 * Evaluates active gestures against defined triggers and zones.
 * Returns a list of triggered IDs and pending IDs with progress for UI feedback.
 */
interface TriggerResult {
    activeTriggers: string[];
    pendingTriggers: { id: string; progress: number }[];
}

function evaluateTriggers(hands: DetectedHand[], timestamp: number): TriggerResult {
    if (!config || !config.gestures) return { activeTriggers: [], pendingTriggers: [] };

    const activeTriggers: string[] = [];
    const pendingTriggers: { id: string; progress: number }[] = [];
    const zone = config.handZone;

    // Define Detectors based on config
    // Note: In a real app we might optimize this to not recreate every frame, 
    // but these are just 4 lightweight objects.
    const detectors = [
        { id: 'start-rec', gesture: config.gestures.startRecording, page: 1, bank: 1 },
        { id: 'stop-rec', gesture: config.gestures.stopRecording, page: 1, bank: 2 },
        { id: 'start-play', gesture: config.gestures.startPlayback, page: 1, bank: 3 },
        { id: 'stop-play', gesture: config.gestures.stopPlayback, page: 1, bank: 4 },
    ];

    detectors.forEach(d => {
        if (d.gesture === 'None') return;

        // Get state
        let state = triggerStates.get(d.id);
        if (!state) {
            state = { enterTime: null, hasTriggered: false, lastSeenTime: null };
            triggerStates.set(d.id, state);
        }

        // Check if ANY hand matches
        let matchFound = false;

        for (const hand of hands) {
            if (hand.gesture !== d.gesture) continue;

            // Check Gesture Zone - filters WHERE gestures trigger actions
            const gZone = config.gestureZone;
            if (gZone && gZone.enabled) {
                const box = hand.box;
                const zBox = gZone.box;
                const isInGestureZone = !(
                    box.x > zBox.x + zBox.width ||
                    box.x + box.width < zBox.x ||
                    box.y > zBox.y + zBox.height ||
                    box.y + box.height < zBox.y
                );
                if (!isInGestureZone) continue; // Skip if outside gesture zone
            }

            // NOTE: handZone is NOT used for trigger filtering - it's for visual feedback only
            matchFound = true;
            break;
        }

        if (matchFound) {
            state.lastSeenTime = timestamp;

            // Timer Logic
            if (state.enterTime === null) {
                state.enterTime = timestamp;
            }

            const duration = config.gestureZone?.holdDurationMs ?? 150; // Configurable, default 150ms
            const elapsed = timestamp - state.enterTime;

            if (elapsed >= duration) {
                if (!state.hasTriggered) {
                    console.log(`[TrackingWorker] ➤ TRIGGERED: ${d.id} (Duration: ${elapsed}ms)`);
                    sendCompanionCommand(d.page, d.bank);

                    // Send Variable Update to Companion
                    if (ws && isWsConnected) {
                        const message = JSON.stringify({
                            type: 'set_variable',
                            name: 'gesture',
                            value: d.id
                        });
                        console.log(`[TrackingWorker] Sending Variable: ${d.id}`);
                        ws.send(message);
                    } else {
                        console.warn(`[TrackingWorker] Cannot send variable: WS Connected? ${isWsConnected}`);
                    }

                    state.hasTriggered = true;
                }
                activeTriggers.push(d.id); // Valid trigger active
            } else {
                // Gesture detected but not yet triggered - add as pending with progress
                const progress = Math.min(1, elapsed / duration);
                pendingTriggers.push({ id: d.id, progress });
            }
        } else {
            // RELEASE DEBOUNCE LOGIC
            // If we were triggered, don't reset immediately. Wait for release delay.
            const releaseDelay = 300; // ms to wait before declaring idle

            if (state.hasTriggered) {
                const timeSinceLastSeen = state.lastSeenTime ? (timestamp - state.lastSeenTime) : 9999;

                if (timeSinceLastSeen < releaseDelay) {
                    // Keep it alive!
                    activeTriggers.push(d.id);
                } else {
                    // Truly expired
                    console.log(`[TrackingWorker] ➤ RELEASED: ${d.id}`);
                    if (ws && isWsConnected) {
                        const message = JSON.stringify({
                            type: 'set_variable',
                            name: 'gesture',
                            value: 'idle'
                        });
                        console.log(`[TrackingWorker] Sending Variable: idle`);
                        ws.send(message);
                    }
                    state.enterTime = null;
                    state.hasTriggered = false;
                    state.lastSeenTime = null;
                }
            } else {
                // Not triggered yet, and lost tracking. Reset immediately.
                state.enterTime = null;
                state.hasTriggered = false;
                state.lastSeenTime = null;
            }
        }
    });

    return { activeTriggers, pendingTriggers };
}

async function initialize(workerConfig: TrackingWorkerConfig): Promise<void> {
    config = workerConfig;
    console.log('[TrackingWorker] Starting initialization with config:', config);

    try {
        console.log('[TrackingWorker] Loading FilesetResolver from CDN...');
        const vision = await FilesetResolver.forVisionTasks(
            config.modelPaths.wasmCdn // Use injected CDN if available, or fallback
        );
        console.log('[TrackingWorker] FilesetResolver loaded successfully');

        // A. Primary Face Tracker (VIDEO mode)
        console.log('[TrackingWorker] Creating FaceLandmarker...');
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: config.modelPaths.faceLandmarker,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numFaces: config.maxFaces,
            minFaceDetectionConfidence: config.thresholds.faceDetect,
            minFacePresenceConfidence: config.thresholds.facePresence,
            minTrackingConfidence: config.thresholds.faceTracking,
            outputFacialTransformationMatrixes: true // ENABLE MATRIX OUTPUT
        });
        console.log('[TrackingWorker] FaceLandmarker created');

        // B. Recovery Engine (Scout/Sniper)
        console.log('[TrackingWorker] Initializing RecoveryEngine...');
        recoveryEngine = new RecoveryEngine();
        await recoveryEngine.initialize(vision, config);
        console.log('[TrackingWorker] RecoveryEngine initialized');

        // C. Gesture Recognizer
        console.log('[TrackingWorker] Creating GestureRecognizer...');
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: config.modelPaths.gestureRecognizer,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: config.maxFaces, // Or fixed 2
            minHandDetectionConfidence: config.thresholds.handDetect,
            minHandPresenceConfidence: config.thresholds.handPresence,
            minTrackingConfidence: config.thresholds.handTracking
        });
        console.log('[TrackingWorker] GestureRecognizer created');

        // D. Initialize Session Manager (ID tracking + smoothing)
        sessionManager = new SessionManager(config.maxFaces);
        console.log('[TrackingWorker] SessionManager initialized');

        // E. Initialize Companion WebSocket
        connectCompanion();

        console.log('[TrackingWorker] Initialization complete, sending INIT_COMPLETE');
        sendMessage({ type: 'INIT_COMPLETE' });

    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[TrackingWorker] Initialization FAILED:', message, err);
        sendMessage({ type: 'ERROR', payload: { message, code: 'INIT_FAILED' } });
    }
}

async function processFrame(bitmap: ImageBitmap, timestamp: number): Promise<void> {
    if (!faceLandmarker || !config || !sessionManager || !recoveryEngine) {
        bitmap.close();
        return;
    }

    // Lazy init buffer
    if (!trackingBuffer) {
        trackingBuffer = new TrackingBuffer(config.maxFaces);
    }

    if (isProcessing) {
        // Backpressure: skip frame if still processing previous
        bitmap.close();
        return;
    }

    isProcessing = true;

    try {
        // MediaPipe requires strictly monotonically increasing timestamps
        // Enforce this to prevent "Packet timestamp mismatch" errors
        let safeTimestamp = Math.floor(timestamp);
        if (safeTimestamp <= lastTimestamp) {
            safeTimestamp = lastTimestamp + 1;
        }
        lastTimestamp = safeTimestamp;

        // ========== FACE TRACKING ==========
        // Main tracker runs in VIDEO mode with timestamp
        // SYNC CALL: detectForVideo is blocking in JS wrapper
        let faceResults = faceLandmarker.detectForVideo(bitmap, safeTimestamp);

        // Recovery strategy if no faces detected
        if (faceResults.faceLandmarks.length === 0) {
            faceResults = recoveryEngine.run(bitmap);
            // Note: RecoveryEngine might not return matrices, but that's fine, FaceSolver handles missing matrix.
        }

        // 1. GEOMETRY SOLVING
        interface SolvedFaceData {
            geometry: SolvedGeometry;
            neutralX: number;
            neutralY: number;
        }
        const solvedFaces: SolvedFaceData[] = [];

        // faceResults.facialTransformationMatrixes contains the 4x4 matrix for each face
        const matrices = faceResults.facialTransformationMatrixes;

        for (let i = 0; i < faceResults.faceLandmarks.length; i++) {
            const landmarks = faceResults.faceLandmarks[i];
            const matrix = matrices && matrices[i] ? matrices[i] : undefined;
            // The matrix is likely a Float32Array or number[] of length 16.

            const geometry = FaceSolver.solve(
                landmarks,
                config.width,
                config.height,
                config.fov,
                config.headWidthMm,
                matrix as number[] | undefined
            );

            if (geometry) {
                // Apply neutral offset (eye-level calculation) - STRICTLY Y-AXIS OFFSET (Screen Space)
                // The user requested this be "unaffected by head yaw, pitch or roll".
                // So we simply add the pixel offset to the center Y.
                // NORMALIZATION: We return 0.0 - 1.0 to ensure UI overlay matches regardless of resolution
                const neutralX = geometry.centerX / config.width;
                const neutralY = (geometry.centerY + config.eyeOffsetPx) / config.height;

                solvedFaces.push({
                    geometry,
                    neutralX,
                    neutralY
                });
            }
        }

        // 2. SESSION MANAGEMENT (ID Assignment & Smoothing)
        const detections = solvedFaces.map(sf => ({
            x: sf.neutralX,
            y: sf.neutralY
        }));

        const matches = sessionManager.update(detections);

        // 3. POPULATE BUFFER
        trackingBuffer.reset();

        let trackedFaceCount = 0;

        for (let slotIdx = 0; slotIdx < config.maxFaces; slotIdx++) {
            const trackerId = sessionManager.getSlotId(slotIdx);

            if (trackerId !== null) {
                const detectionIdx = matches.get(trackerId);
                if (detectionIdx !== undefined) {
                    const solved = solvedFaces[detectionIdx];

                    // Apply smoothing
                    const smoothed = sessionManager.applySmoothing(trackerId, {
                        x: solved.neutralX,
                        y: solved.neutralY,
                        z: solved.geometry.depthMm,
                        yaw: solved.geometry.yawDeg,
                        roll: solved.geometry.rollDeg,
                        pitch: solved.geometry.pitchDeg
                    }, timestamp);

                    if (smoothed) {
                        trackingBuffer.setFace(slotIdx, {
                            id: trackerId,
                            x: smoothed.x,
                            y: smoothed.y,
                            z: smoothed.z / 1000.0,
                            yaw: smoothed.yaw,
                            pitch: smoothed.pitch,
                            roll: smoothed.roll,
                            neutral_x: smoothed.x,
                            neutral_y: smoothed.y,
                            landmarks: config.showMesh ? solved.geometry.landmarksNormalized : undefined
                        });
                        trackedFaceCount++;
                    }
                }
            }
        }


        // ========== HAND TRACKING ==========
        // Optimization: Run hand tracking only every 3rd frame (e.g. 10fps if main is 30fps)
        // This significantly reduces CPU/GPU load while keeping face tracking smooth.

        let hands: DetectedHand[] = lastDetectedHands; // Default to cached hands

        // Run detection on modulus 3 (0, 3, 6...)
        if (gestureRecognizer && (frameCount % 3 === 0)) {
            const gestureResults = gestureRecognizer.recognizeForVideo(bitmap, safeTimestamp);
            const newHands: DetectedHand[] = [];

            for (let i = 0; i < gestureResults.landmarks.length; i++) {
                const landmarks = gestureResults.landmarks[i];
                const isLeft = gestureResults.handedness[i]?.[0]?.categoryName === 'Left';

                // Gesture Extraction
                let gestureName = GestureType.None;
                let gestureScore = 0;

                // gestureResults.gestures is Array<Category[]>
                if (gestureResults.gestures && gestureResults.gestures[i] && gestureResults.gestures[i].length > 0) {
                    const topGesture = gestureResults.gestures[i][0];
                    const categoryName = topGesture.categoryName;
                    gestureScore = topGesture.score;

                    if (Object.values(GestureType).includes(categoryName as GestureType)) {
                        gestureName = categoryName as GestureType;
                    } else if (categoryName !== 'None') {
                        gestureName = (categoryName as GestureType) || GestureType.Unknown;
                    }
                }

                let minX = 1, minY = 1, maxX = 0, maxY = 0;
                for (const lm of landmarks) {
                    if (lm.x < minX) minX = lm.x;
                    if (lm.y < minY) minY = lm.y;
                    if (lm.x > maxX) maxX = lm.x;
                    if (lm.y > maxY) maxY = lm.y;
                }

                // Mirror X for webcam
                const mirroredX = 1 - (minX + (maxX - minX));

                newHands.push({
                    box: { x: mirroredX, y: minY, width: maxX - minX, height: maxY - minY },
                    isLeft,
                    landmarks: landmarks.map(l => ({ x: l.x, y: l.y, z: l.z })),
                    gesture: gestureName,
                    gestureScore: gestureScore
                });
            }

            // Update cache
            lastDetectedHands = newHands;
            hands = newHands;
        }

        // Increment frame counter for next loop
        frameCount++;

        trackingBuffer.setHeader(timestamp, trackedFaceCount, hands.length);

        // ========== SEND RESULTS ==========
        const dataToSend = new Float32Array(trackingBuffer.getFloat32Array());

        // ========== TRIGGER LOGIC ==========
        // Run every frame (using cached hands if optimization is on)
        const { activeTriggers, pendingTriggers } = evaluateTriggers(hands, timestamp);

        const message: WorkerTrackingBufferMessage = {
            type: 'TRACKING_BUFFER',
            payload: {
                buffer: dataToSend.buffer,
                hands,
                activeTriggers,
                pendingTriggers
            }
        };

        (self as unknown as DedicatedWorkerGlobalScope).postMessage(message, [dataToSend.buffer]);

    } catch (err) {
        console.error("Worker frame processing error:", err);
    } finally {
        bitmap.close();
        isProcessing = false;
    }
}

// ========================
// Message Handling
// ========================

function sendMessage(message: WorkerToMainMessage): void {
    self.postMessage(message);
}

let isInitialized = false;

self.onmessage = async (event: MessageEvent<MainToWorkerMessage>) => {
    const { type, payload } = event.data;

    if (type === 'INITIALIZE') {
        if (isInitialized) return; // Prevent double init
        console.log("[TrackingWorker] Received INITIALIZE with config", payload);

        await initialize(payload);

        isInitialized = true;
        // Sending INIT_COMPLETE is handled inside initialize() or we can do it here.
        // My existing initialize() sends it at the end. keeping it there.
        return;
    }

    if (type === 'PROCESS_FRAME') {
        await processFrame(payload.bitmap, payload.timestamp);
        return;
    }

    if (type === 'UPDATE_CONFIG') {
        // Block updates until ready
        if (!isInitialized || !faceLandmarker) {
            console.warn("[TrackingWorker] Ignoring UPDATE_CONFIG: Not initialized yet");
            return;
        }

        console.log('[TrackingWorker] Received UPDATE_CONFIG:', payload);
        if (config) {
            config = { ...config, ...payload, thresholds: { ...config.thresholds, ...(payload.thresholds || {}) } };

            // Re-evaluate connection if companion config changed (naive check)
            if (payload.companion && (payload.companion.host !== config.companion.host || payload.companion.port !== config.companion.port)) {
                if (ws) ws.close();
                // Reconnect will happen via connectCompanion() call next frame or immediately?
                // Best to just call it.
                connectCompanion();
            }

            if (faceLandmarker) {
                try {
                    faceLandmarker.setOptions({
                        minFaceDetectionConfidence: config.thresholds.faceDetect,
                        minFacePresenceConfidence: config.thresholds.facePresence,
                        minTrackingConfidence: config.thresholds.faceTracking
                    });
                } catch (e) {
                    console.warn('[TrackingWorker] Could not setOptions on FaceLandmarker', e);
                }
            }
        }
        return;
    }
};

console.log('[TrackingWorker] Script loaded');