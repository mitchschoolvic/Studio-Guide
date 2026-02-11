import { CameraConfig, GeometryConfig, UIConfig, AlertConfig } from '../../../src/shared/types';

export interface TrackingConfig extends
    Pick<CameraConfig, 'width' | 'height' | 'fov'>,
    Pick<GeometryConfig, 'headWidthMm' | 'depthNearMm' | 'depthFarMm'>,
    Pick<GeometryConfig, 'headWidthMm' | 'depthNearMm' | 'depthFarMm'>,
    Pick<GeometryConfig, 'headWidthMm' | 'depthNearMm' | 'depthFarMm'>,
    Pick<UIConfig, 'showMesh' | 'showNeutralDot' | 'showMarkers' | 'showGrayscale' | 'eyeOffsetPx' | 'mapScaleX' | 'overlay' | 'gestureVisibility' | 'duoFaceOffset'> {

    // Camera
    cameraDeviceId: string;     // WebRTC Device ID (Maps to frontendDeviceId)

    // AI / Processing
    maxFaces: number;
    showFps?: boolean;

    // Safe Zone Configuration (New)
    zone: {
        enabled: boolean;
        minDepthMm: number;    // "Step Back" threshold (Too Close)
        maxDepthMm: number;    // "Step Closer" threshold (Too Far)
        widthPercent: number;  // 0.0 to 1.0 (Horizontal active area)
    };

    // Hand Interaction Zone (New)
    handZone?: HandZoneConfig;

    // Gesture Detection Zone - filters where gestures are recognized
    gestureZone?: GestureZoneConfig;

    // Gesture Mappings (New)
    gestures: GestureConfig;

    // Email Alerts
    alerts?: AlertConfig;
}

export interface GestureConfig {
    startRecording: GestureType;
    stopRecording: GestureType;
    startPlayback: GestureType;
    stopPlayback: GestureType;
}

export interface HandZoneConfig {
    enabled: boolean;
    showOverlay: boolean;
    showBoundingBox: boolean; // New: Toggle for hand bounding boxes
    holdDurationMs: number; // e.g., 3000
    box: {                  // Normalized 0.0 - 1.0 relative to video frame
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface GestureZoneConfig {
    enabled: boolean;
    showOverlay: boolean;
    holdDurationMs: number; // Debounce time before gesture triggers
    box: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface FaceVector {
    id: number;

    // Position (World/Camera Space)
    x: number;      // Normalized 0-1 OR Pixels (Handled by normalization logic)
    y: number;      // Normalized 0-1 OR Pixels
    z: number;      // Depth in meters

    // Rotation (Euler Angles in Degrees)
    yaw: number;
    pitch: number;
    roll: number;

    // Raw/Debug Data
    neutral_x: number;
    neutral_y: number;

    // 3D Landmarks for Mesh Rendering (Normalized x,y,z)
    landmarks?: [number, number, number][];
}

export enum GestureType {
    None = "None",
    Closed_Fist = "Closed_Fist",
    Open_Palm = "Open_Palm",
    Pointing_Up = "Pointing_Up",
    Thumb_Down = "Thumb_Down",
    Thumb_Up = "Thumb_Up",
    Victory = "Victory",
    ILoveYou = "ILoveYou",
    Unknown = "Unknown"
}

export const GestureIcons: Record<GestureType, { label: string, icon: string }> = {
    [GestureType.None]: { label: "None", icon: "⛔" },
    [GestureType.Closed_Fist]: { label: "Closed Fist", icon: "✊" },
    [GestureType.Open_Palm]: { label: "Open Palm", icon: "✋" },
    [GestureType.Pointing_Up]: { label: "Pointing Up", icon: "👆" },
    [GestureType.Thumb_Down]: { label: "Thumb Down", icon: "👎" },
    [GestureType.Thumb_Up]: { label: "Thumb Up", icon: "👍" },
    [GestureType.Victory]: { label: "Victory", icon: "✌️" },
    [GestureType.ILoveYou]: { label: "I Love You", icon: "🤟" },
    [GestureType.Unknown]: { label: "Unknown", icon: "❓" }
};

export interface DetectedHand {
    box: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    isLeft: boolean;
    landmarks?: { x: number; y: number; z: number }[];
    gesture: GestureType;
    gestureScore: number;
}

export interface TrackingPayload {
    type: "TRACKING";
    timestamp: number;
    sequence_id: number;
    total_faces_detected: number;
    faces: (FaceVector | null)[]; // Fixed size array based on maxFaces
    hands?: DetectedHand[];
    activeTriggers?: string[]; // IDs of detectors triggered this frame
    pendingTriggers?: { id: string; progress: number }[]; // IDs pending with progress 0-1
}

export interface StatusPayload {
    type: "STATUS";
    code: "BOOT" | "READY" | "ERROR" | "WARN";
    message: string;
}

export type IncomingMessage = TrackingPayload | StatusPayload | TrackingBufferPayload;

// ============================================
// Zero-Copy Buffer Layout
// ============================================

export const TRACKING_BUFFER_HEADER_SIZE = 4; // Type, Timestamp, FaceCount, HandCount
export const NUM_LANDMARKS = 478;
export const FLOATS_PER_FACE = 10 + (NUM_LANDMARKS * 3); // Scalars + (478 * 3)

export const FACE_OFFSET_ID = 0;
export const FACE_OFFSET_X = 1;
export const FACE_OFFSET_Y = 2;
export const FACE_OFFSET_Z = 3;
export const FACE_OFFSET_YAW = 4;
export const FACE_OFFSET_PITCH = 5;
export const FACE_OFFSET_ROLL = 6;
export const FACE_OFFSET_NEUTRAL_X = 7;
export const FACE_OFFSET_NEUTRAL_Y = 8;
export const FACE_OFFSET_HAS_MESH = 9; // 0.0 or 1.0
export const FACE_OFFSET_LANDMARKS_START = 10;
// Total 9 + 1 + (478*3) floats per face.

export interface TrackingBufferPayload {
    type: "TRACKING_BUFFER";
    buffer: ArrayBuffer;
}