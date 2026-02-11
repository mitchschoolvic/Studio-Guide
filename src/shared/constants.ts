/**
 * Shared Application Constants
 * Single Source of Truth for all magic numbers
 */

// Physics & Real World Dimensions
export const PHYSICS_DEFAULTS = {
    AVG_HEAD_WIDTH_MM: 160.0,
    DEPTH_NEAR_MM: 500.0,
    DEPTH_FAR_MM: 5000.0,
} as const;

// Camera Hardware Defaults
export const CAMERA_DEFAULTS = {
    WIDTH: 1920,
    HEIGHT: 1080,
    FOV: 50.0,
    FRONTEND_DEVICE_ID: null,
    BACKEND_INDEX: 0,
} as const;

// Network Configuration
export const NETWORK_DEFAULTS = {
    ZMQ_PUB_PORT: 5555,
    ZMQ_SUB_PORT: 5556,
    WS_PORT: 8000,
} as const;

// Processing & AI Thresholds
export const PROCESSING_DEFAULTS = {
    // Face Tracking - Video Mode (Standard)
    FACE_DETECT_CONFIDENCE: 0.5,
    FACE_PRESENCE_CONFIDENCE: 0.5,
    FACE_TRACKING_CONFIDENCE: 0.5,

    // Face Detection - Recovery (Image/Scout Mode)
    RECOVERY_DETECT_CONFIDENCE: 0.3,
    RECOVERY_PRESENCE_CONFIDENCE: 0.3,
    RECOVERY_TRACKING_CONFIDENCE: 0.3,
    SCOUT_DETECT_CONFIDENCE: 0.2, // For BlazeFace

    // Hand Tracking
    HAND_DETECT_CONFIDENCE: 0.5,
    HAND_PRESENCE_CONFIDENCE: 0.5,
    HAND_TRACKING_CONFIDENCE: 0.5,

    // General
    MAX_LOST_FRAMES: 15,
    TARGET_FPS: 60,
    BBOX_EXPANSION: 1.6,
    MAX_FACES: 2,
    MAX_HANDS: 2,
} as const;

// Model Paths (Relative to public/ or CWD)
export const MODEL_PATHS = {
    FACE_LANDMARKER: './models/face_landmarker.task',
    FACE_DETECTOR_BLAZE: './models/blaze_face_short_range.tflite',
    GESTURE_RECOGNIZER: './models/gesture_recognizer.task',
    WASM_CDN: './wasm',
} as const;

// Map Visualization
export const MAP_DEFAULTS = {
    GRID_SIZE: 20,
    DEPTH_RANGE: 18, // Three.js units (matches frontend config)
    X_RANGE: 10,     // Three.js units
} as const;

// Recovery Strategy Settings
export const RECOVERY_DEFAULTS = {
    CENTER_CROP_SIZE: 0.5, // 50% of screen
    SNIPER_PADDING: 0.5,   // 50% padding around detected face
    OFFSCREEN_SIZE: 256,
} as const;

export const GESTURE_DEFAULTS = {
    startRecording: 'Thumb_Up',
    stopRecording: 'Open_Palm',
    startPlayback: 'Pointing_Up',
    stopPlayback: 'Closed_Fist',
} as const;

export const HAND_ZONE_DEFAULTS = {
    enabled: true,
    showOverlay: true,
    showBoundingBox: true,
    holdDurationMs: 3000,
    box: { x: 0.05, y: 0.05, width: 0.2, height: 0.2 } // Top Left default
} as const;

export const GESTURE_ZONE_DEFAULTS = {
    enabled: true,
    showOverlay: true,
    holdDurationMs: 150, // Debounce time before gesture triggers
    box: { x: 0.3, y: 0.2, width: 0.4, height: 0.6 } // Center-ish default
} as const;

