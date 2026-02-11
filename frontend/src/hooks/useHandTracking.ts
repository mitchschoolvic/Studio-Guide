import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandZoneConfig } from '../types/schemas';

interface HandTrackingResult {
    isDetected: boolean;
    isInsideZone: boolean;
    progress: number; // 0.0 to 1.0
    isTriggered: boolean;
    status: string;
}

// Helper to compute bounding box from landmarks
function computeBoundingBox(landmarks: any[]) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    landmarks.forEach(lm => {
        if (lm.x < minX) minX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y > maxY) maxY = lm.y;
    });
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

export interface DetectedHand {
    box: { x: number, y: number, width: number, height: number }; // Normalized
    isLeft: boolean; // Based on handedness
}

export function useHandTracking(
    videoRef: React.RefObject<HTMLVideoElement>,
    config: HandZoneConfig
) {
    const [result, setResult] = useState<HandTrackingResult & { hands: DetectedHand[] }>({
        isDetected: false,
        isInsideZone: false,
        progress: 0,
        isTriggered: false,
        status: 'Initializing...',
        hands: []
    });

    const landmarkerRef = useRef<HandLandmarker | null>(null);
    const rafId = useRef<number | null>(null);
    const lastVideoTime = useRef(-1);

    // Live Config Ref (to avoid restarting loop)
    const configRef = useRef(config);
    useEffect(() => { configRef.current = config; }, [config]);

    // Timer Logic State
    const enterTimeRef = useRef<number | null>(null);
    const isTriggeredRef = useRef(false);
    const lastLandmarkTimeRef = useRef(0); // Track last inference time

    useEffect(() => {
        // Always init if enabled, or if we need to re-init.
        // If enabled toggles, we restart.
        if (!config.enabled) return;

        let active = true;

        const init = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
                );

                const landmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 2, // Support up to 2 hands
                    minHandDetectionConfidence: 0.5,
                    minHandPresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                if (!active) {
                    landmarker.close();
                    return;
                }

                landmarkerRef.current = landmarker;
                setResult(prev => ({ ...prev, status: 'Ready' }));
                loop();
            } catch (e: any) {
                console.error(e);
                if (active) setResult(prev => ({ ...prev, status: 'Error' }));
            }
        };
        init();

        return () => {
            active = false;
            if (rafId.current) cancelAnimationFrame(rafId.current);
            if (landmarkerRef.current) {
                landmarkerRef.current.close();
                landmarkerRef.current = null;
            }
        };
    }, [config.enabled]); // Only restart if enabled toggles

    const loop = useCallback(() => {
        if (!landmarkerRef.current || !videoRef.current) return;

        const video = videoRef.current;
        if (video.currentTime !== lastVideoTime.current && video.readyState >= 2) {
            lastVideoTime.current = video.currentTime;

            // PERFORMANCE: Cap at ~15 FPS (66ms) to save GPU for Face Tracking
            const now = performance.now();
            if (now - lastLandmarkTimeRef.current < 66) {
                rafId.current = requestAnimationFrame(loop);
                return;
            }
            lastLandmarkTimeRef.current = now;

            // Use LIVE config
            const currentConfig = configRef.current;
            const { box: zoneBox } = currentConfig;

            const results = landmarkerRef.current.detectForVideo(video, now);

            const detectedHands: DetectedHand[] = [];
            let isInside = false;

            if (results.landmarks.length > 0) {
                results.landmarks.forEach((landmarks, index) => {
                    const handedness = results.handedness[index]?.[0]?.categoryName === 'Left';

                    // 1. Compute Box (Raw coords)
                    const rawBox = computeBoundingBox(landmarks);

                    // 2. Mirror Box X for display
                    // The webcam is mirrored (scaleX(-1)), so we mirrored logic.
                    // Logical X = 1 - (rawX + rawW)
                    const mirroredX = 1 - (rawBox.x + rawBox.width);

                    const handBox = { x: mirroredX, y: rawBox.y, width: rawBox.width, height: rawBox.height };

                    detectedHands.push({
                        box: handBox,
                        isLeft: handedness
                    });

                    // 3. Check AABB Intersection (Overlap)
                    const isOverlapping = !(
                        handBox.x > zoneBox.x + zoneBox.width ||
                        handBox.x + handBox.width < zoneBox.x ||
                        handBox.y > zoneBox.y + zoneBox.height ||
                        handBox.y + handBox.height < zoneBox.y
                    );

                    if (isOverlapping) {
                        isInside = true;
                    }
                });
            }

            // Timer Logic
            // Reuse 'now' from above
            let progress = 0;

            if (isInside) {
                if (enterTimeRef.current === null) {
                    enterTimeRef.current = now;
                }

                const elapsed = now - enterTimeRef.current;
                progress = Math.min(1, elapsed / currentConfig.holdDurationMs);

                if (progress >= 1 && !isTriggeredRef.current) {
                    isTriggeredRef.current = true;
                }
            } else {
                enterTimeRef.current = null;
                isTriggeredRef.current = false;
                progress = 0;
            }

            const newResult = {
                isDetected: detectedHands.length > 0,
                isInsideZone: isInside,
                progress,
                isTriggered: isTriggeredRef.current,
                status: 'Running',
                hands: detectedHands
            };

            setResult(prev => {
                // deep-ish compare to avoid render spam
                if (
                    prev.isDetected === newResult.isDetected &&
                    prev.isInsideZone === newResult.isInsideZone &&
                    Math.abs(prev.progress - newResult.progress) < 0.01 &&
                    prev.isTriggered === newResult.isTriggered &&
                    prev.status === newResult.status &&
                    prev.hands.length === newResult.hands.length &&
                    // Check ALL hands for movement > 0.1% (0.001)
                    prev.hands.every((h, i) =>
                        Math.abs(h.box.x - newResult.hands[i].box.x) < 0.001 &&
                        Math.abs(h.box.y - newResult.hands[i].box.y) < 0.001 &&
                        Math.abs(h.box.width - newResult.hands[i].box.width) < 0.001 &&
                        Math.abs(h.box.height - newResult.hands[i].box.height) < 0.001
                    )
                ) {
                    return prev;
                }
                return newResult;
            });
        }

        rafId.current = requestAnimationFrame(loop);
    }, [config]);

    return result;
}
