export interface CameraConfig {
    width: number;
    height: number;
    fov: number;
    frontendDeviceId: string | null;
    backendIndex: number;
}

export interface GeometryConfig {
    headWidthMm: number;
    depthNearMm: number;
    depthFarMm: number;
    bboxExpansionFactor: number;
}

export interface NetworkConfig {
    zmqPubPort: number;
    zmqSubPort: number;
    wsPort: number;
}

export interface ProcessingConfig {
    detectionConfidence: number;
    meshConfidence: number;
    maxLostFrames: number;
    targetFps: number;
}

export interface UIConfig {
    showMesh: boolean;
    showNeutralDot: boolean;
    eyeOffsetPx: number;
    mapScaleX: number;
    showMarkers: boolean;
    showGrayscale: boolean;
    overlay: OverlayConfig;
    gestureVisibility?: Record<string, boolean>;
    duoFaceOffset: number; // Configurable spread for dual outlines
    autoReconnectCamera: boolean; // Auto-reconnect when USB camera reappears
}

export interface OverlayConfig {
    enabled: boolean;
    x: number;      // Normalized 0-1
    y: number;      // Normalized 0-1
    scale: number;
}

export interface HandZoneConfig {
    enabled: boolean;
    showOverlay: boolean;
    showBoundingBox: boolean;
    holdDurationMs: number;
    box: {
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

// Alert trigger types for email notifications
export type AlertTriggerType = 'camera_connected' | 'camera_disconnected';

// Single alert rule configuration
export interface AlertRule {
    id: string;
    enabled: boolean;
    trigger: AlertTriggerType;
    endpointUrl: string;
    subject: string;
}

// Alert configuration
export interface AlertConfig {
    rules: AlertRule[];
}

export interface MapConfig {
    gridSize: number;
    depthRange: number;
    xRange: number;
    maxTrackedFaces: number;
}

export interface AppConfig {
    camera: CameraConfig;
    geometry: GeometryConfig;
    network: NetworkConfig;
    processing: ProcessingConfig;
    ui: UIConfig;
    map: MapConfig;
    handZone: HandZoneConfig;
    gestureZone: GestureZoneConfig;
    gestures: Record<string, string>;
    alerts?: AlertConfig;
}

