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

// --- Standby / Device Monitoring ---

export interface StandbyDevice {
    id: string;           // UUID
    label: string;        // User-friendly name, e.g. "PTZ Camera 1"
    ip: string;           // IPv4 address, e.g. "192.168.1.100"
}

export interface MonitorSleepConfig {
    enabled: boolean;
    timeoutMinutes: number;
    activeHoursEnabled: boolean;
    activeHoursStart: string;        // HH:MM, e.g. "09:00"
    activeHoursEnd: string;          // HH:MM, e.g. "17:00"
}

export interface MonitorSleepResult {
    success: boolean;
    unsupported?: boolean;
    error?: string;
}

export interface StandbyConfig {
    enabled: boolean;
    devices: StandbyDevice[];
    imagePath: string | null;         // Path to stored image in userData
    imagefit: 'cover' | 'contain';    // How the image fills the screen
    timeoutSeconds: number;           // Seconds ALL devices must be offline before standby
    pingIntervalSeconds: number;      // How often to ping (default: 10)
    monitorSleep: MonitorSleepConfig; // Sleep displays after user inactivity
    lastKnownStatuses?: DeviceStatus[]; // Persisted device statuses from last session
}

export interface DeviceStatus {
    id: string;
    label: string;
    ip: string;
    online: boolean;
    lastSeen: number;     // Unix timestamp ms
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
    gestures: Record<string, string | boolean>;
    alerts?: AlertConfig;
    standby?: StandbyConfig;
}

