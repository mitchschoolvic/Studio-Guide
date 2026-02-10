/**
 * Type-safe message contracts for tracking Web Worker communication
 */

import { TrackingConfig, TrackingPayload, DetectedHand } from './schemas';

// ========================
// Main Thread → Worker
// ========================

export interface WorkerInitMessage {
    type: 'INITIALIZE';
    payload: TrackingWorkerConfig;
}

export interface WorkerUpdateConfigMessage {
    type: 'UPDATE_CONFIG';
    payload: Partial<TrackingWorkerConfig>;
}

export interface WorkerFrameMessage {
    type: 'PROCESS_FRAME';
    payload: {
        bitmap: ImageBitmap;
        timestamp: number;
    };
}

export type MainToWorkerMessage = WorkerInitMessage | WorkerUpdateConfigMessage | WorkerFrameMessage;

// ========================
// Worker → Main Thread
// ========================

export interface WorkerReadyMessage {
    type: 'INIT_COMPLETE';
}

export interface WorkerErrorMessage {
    type: 'ERROR';
    payload: {
        message: string;
        code?: string;
    };
}

export interface WorkerTrackingUpdateMessage {
    type: 'TRACKING_UPDATE';
    payload: TrackingPayload;
}

export interface WorkerTrackingBufferMessage {
    type: 'TRACKING_BUFFER';
    payload: {
        buffer: ArrayBuffer;
        hands: DetectedHand[];
        activeTriggers: string[];
        pendingTriggers: { id: string; progress: number }[]; // Progress 0-1 for loading animation
    };
}

export interface WorkerVariableMessage {
    type: 'VARIABLE_UPDATE';
    payload: {
        messageType: 'recording' | 'playback' | 'generic';
        value: any;
        timestamp: number;
    };
}

export interface WorkerCompanionStatusMessage {
    type: 'COMPANION_STATUS';
    payload: {
        isConnected: boolean;
    };
}

export type WorkerToMainMessage = WorkerReadyMessage | WorkerErrorMessage | WorkerTrackingUpdateMessage | WorkerTrackingBufferMessage | WorkerVariableMessage | WorkerCompanionStatusMessage;

// ========================
// Config subset for worker
// ========================

export interface TrackingWorkerConfig {
    // Camera dimensions for geometry solving
    width: number;
    height: number;
    fov: number;

    // AI settings
    maxFaces: number;
    showMesh: boolean;

    // Geometry calibration
    headWidthMm: number;
    eyeOffsetPx: number;

    // Safe Zone for Logic
    handZone?: {
        enabled: boolean;
        box: { x: number, y: number, width: number, height: number };
        holdDurationMs: number;
    };

    // Gesture Detection Zone - filters where gestures are recognized
    gestureZone?: {
        enabled: boolean;
        box: { x: number, y: number, width: number, height: number };
        holdDurationMs: number;
    };

    // Companion Config
    companion: {
        host: string;
        port: number;
    };

    // Trigger Mappings
    gestures: {
        startRecording: string;
        stopRecording: string;
        startPlayback: string;
        stopPlayback: string;
    };

    // Dynamic Thresholds & Paths (Injected)
    modelPaths: {
        faceLandmarker: string;
        faceDetector: string;
        gestureRecognizer: string;
        wasmCdn: string;
    };
    thresholds: {
        faceDetect: number;
        facePresence: number;
        faceTracking: number;
        handDetect: number;
        handPresence: number;
        handTracking: number;
        recoveryDetect: number;
        scoutDetect: number;
    };
    recovery: {
        centerCropSize: number;
        sniperPadding: number;
        offscreenSize: number;
    };
}

/**
 * Extract worker-relevant config from full TrackingConfig
 * NOTE: This is now a base mapper. The caller must inject the constants.
 */
export function toWorkerConfig(config: TrackingConfig, constants: any): TrackingWorkerConfig {
    return {
        width: config.width,
        height: config.height,
        fov: config.fov,
        maxFaces: config.maxFaces,
        showMesh: config.showMesh,
        headWidthMm: config.headWidthMm,
        eyeOffsetPx: config.eyeOffsetPx,

        // NEW: Logic & Companion
        handZone: config.handZone ? {
            enabled: config.handZone.enabled,
            box: config.handZone.box,
            holdDurationMs: config.handZone.holdDurationMs
        } : undefined,

        gestureZone: config.gestureZone ? {
            enabled: config.gestureZone.enabled,
            box: config.gestureZone.box,
            holdDurationMs: config.gestureZone.holdDurationMs
        } : undefined,

        companion: {
            host: 'localhost', // Default, could be in config if needed
            port: 28492        // Default
        },

        gestures: {
            startRecording: config.gestures.startRecording,
            stopRecording: config.gestures.stopRecording,
            startPlayback: config.gestures.startPlayback,
            stopPlayback: config.gestures.stopPlayback
        },

        // Injected constants
        modelPaths: {
            faceLandmarker: constants.MODEL_PATHS.FACE_LANDMARKER,
            faceDetector: constants.MODEL_PATHS.FACE_DETECTOR_BLAZE,
            gestureRecognizer: constants.MODEL_PATHS.GESTURE_RECOGNIZER,
            wasmCdn: constants.MODEL_PATHS.WASM_CDN
        },
        thresholds: {
            faceDetect: constants.PROCESSING_DEFAULTS.FACE_DETECT_CONFIDENCE,
            facePresence: constants.PROCESSING_DEFAULTS.FACE_PRESENCE_CONFIDENCE,
            faceTracking: constants.PROCESSING_DEFAULTS.FACE_TRACKING_CONFIDENCE,
            handDetect: constants.PROCESSING_DEFAULTS.HAND_DETECT_CONFIDENCE,
            handPresence: constants.PROCESSING_DEFAULTS.HAND_PRESENCE_CONFIDENCE,
            handTracking: constants.PROCESSING_DEFAULTS.HAND_TRACKING_CONFIDENCE,
            recoveryDetect: constants.PROCESSING_DEFAULTS.RECOVERY_DETECT_CONFIDENCE,
            scoutDetect: constants.PROCESSING_DEFAULTS.SCOUT_DETECT_CONFIDENCE
        },
        recovery: {
            centerCropSize: constants.RECOVERY_DEFAULTS.CENTER_CROP_SIZE,
            sniperPadding: constants.RECOVERY_DEFAULTS.SNIPER_PADDING,
            offscreenSize: constants.RECOVERY_DEFAULTS.OFFSCREEN_SIZE
        }
    };
}
