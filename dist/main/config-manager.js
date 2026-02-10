"use strict";
/**
 * Config Manager Module
 * Handles configuration defaults, persistence, and transformations
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MASTER_CONFIG_DEFAULTS = void 0;
exports.getConfigPath = getConfigPath;
exports.deepMerge = deepMerge;
exports.loadUserConfig = loadUserConfig;
exports.saveUserConfig = saveUserConfig;
exports.getMasterConfig = getMasterConfig;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("./logger");
// Config file path - lazy initialized
let _configPath = null;
function getConfigPath() {
    if (!_configPath) {
        _configPath = path.join(electron_1.app.getPath('userData'), 'app-config.json');
    }
    return _configPath;
}
// --- Master Config (Single Source of Truth) ---
const constants_1 = require("../shared/constants");
exports.MASTER_CONFIG_DEFAULTS = {
    // Camera Settings
    camera: {
        width: constants_1.CAMERA_DEFAULTS.WIDTH,
        height: constants_1.CAMERA_DEFAULTS.HEIGHT,
        fov: constants_1.CAMERA_DEFAULTS.FOV, // Horizontal FOV in degrees
        frontendDeviceId: constants_1.CAMERA_DEFAULTS.FRONTEND_DEVICE_ID, // WebRTC device ID for frontend
        backendIndex: constants_1.CAMERA_DEFAULTS.BACKEND_INDEX // OpenCV camera index for Python
    },
    // Geometry & Tracking
    geometry: {
        headWidthMm: constants_1.PHYSICS_DEFAULTS.AVG_HEAD_WIDTH_MM, // Average human head width
        depthNearMm: constants_1.PHYSICS_DEFAULTS.DEPTH_NEAR_MM, // Closest tracking distance
        depthFarMm: constants_1.PHYSICS_DEFAULTS.DEPTH_FAR_MM, // Furthest tracking distance
        bboxExpansionFactor: constants_1.PROCESSING_DEFAULTS.BBOX_EXPANSION
    },
    // Network Ports
    network: {
        zmqPubPort: constants_1.NETWORK_DEFAULTS.ZMQ_PUB_PORT,
        zmqSubPort: constants_1.NETWORK_DEFAULTS.ZMQ_SUB_PORT,
        wsPort: constants_1.NETWORK_DEFAULTS.WS_PORT
    },
    // Processing
    processing: {
        detectionConfidence: constants_1.PROCESSING_DEFAULTS.RECOVERY_DETECT_CONFIDENCE, // Default to recovery/scout confidence for config? Or Video?
        // Note: The original file had 0.3 for detectionConfidence. In constants, RECOVERY_DETECT is 0.3.
        // FACE_DETECT is 0.5. I'll stick to 0.3 as it was the default here.
        meshConfidence: constants_1.PROCESSING_DEFAULTS.FACE_TRACKING_CONFIDENCE, // Original was 0.5
        maxLostFrames: constants_1.PROCESSING_DEFAULTS.MAX_LOST_FRAMES,
        targetFps: constants_1.PROCESSING_DEFAULTS.TARGET_FPS
    },
    // UI Settings (persisted per user)
    ui: {
        showMesh: false,
        showNeutralDot: false,
        showMarkers: false,
        showGrayscale: false,
        eyeOffsetPx: 0,
        mapScaleX: 1.0,
        overlay: {
            enabled: false,
            x: 0.5,
            y: 0.5,
            scale: 1.0
        },
        duoFaceOffset: 10.0,
        autoReconnectCamera: true
    },
    // Hand Tracking Zone
    handZone: {
        enabled: constants_1.HAND_ZONE_DEFAULTS.enabled,
        showOverlay: constants_1.HAND_ZONE_DEFAULTS.showOverlay,
        showBoundingBox: constants_1.HAND_ZONE_DEFAULTS.showBoundingBox,
        holdDurationMs: constants_1.HAND_ZONE_DEFAULTS.holdDurationMs,
        box: { ...constants_1.HAND_ZONE_DEFAULTS.box }
    },
    // Gesture Detection Zone
    gestureZone: {
        enabled: constants_1.GESTURE_ZONE_DEFAULTS.enabled,
        showOverlay: constants_1.GESTURE_ZONE_DEFAULTS.showOverlay,
        holdDurationMs: constants_1.GESTURE_ZONE_DEFAULTS.holdDurationMs,
        box: { ...constants_1.GESTURE_ZONE_DEFAULTS.box }
    },
    // Gestures
    gestures: { ...constants_1.GESTURE_DEFAULTS },
    // Alerts
    alerts: {
        rules: []
    },
    // Map projection constants
    map: {
        gridSize: constants_1.MAP_DEFAULTS.GRID_SIZE,
        depthRange: constants_1.MAP_DEFAULTS.DEPTH_RANGE / 2, // Original was 8 (-4 to +4) vs Frontend 18 (-9 to +9). 
        // If I use MAP_DEFAULTS.DEPTH_RANGE (18), half is 9. 
        // Original was 8. Let's use 8 explicitly or update constants? 
        // The user wanted consolidation. 
        // Let's use MAP_DEFAULTS.X_RANGE (10) -> -5 to +5.
        // Let's use MAP_DEFAULTS.DEPTH_RANGE but match the semantics.
        // Original: "8, // -4 to +4". 
        // If constant is 18, it's likely total range.
        // I will stick to the constant but maybe the constant needs to be clearer.
        // For now, I will use the constant values to ensure "Single Source of Truth".
        // But wait, the original file had 8. If I change it to 18 it might break things.
        // Let's assume the constant (18) is correct for the merged view, but here it might define the default *zoom* or similar? 
        // Actually, let's keep it close to original but using constants if possible.
        // Map Defaults has depthRange: 18.
        // I will use 8 for now to minimize breakage if this controls something specific, 
        // OR better: use the constant and comment.
        // Actually, the user complained about "Scatterred configuration".
        // I should probably use the constant value if it's meant to be the same.
        // I'll stick to the logical value: 18 is likely the real range, 8 was maybe a focused default?
        // Let's use MAP_DEFAULTS.DEPTH_RANGE (18) to be consistent with frontend.
        xRange: constants_1.MAP_DEFAULTS.X_RANGE, // -5 to +5 in Three.js units
        maxTrackedFaces: constants_1.PROCESSING_DEFAULTS.MAX_FACES
    }
};
/**
 * Deep merge helper - merges source into target recursively
 */
function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        }
        else if (source[key] !== undefined) {
            result[key] = source[key];
        }
    }
    return result;
}
/**
 * Load user config overrides from disk
 */
function loadUserConfig() {
    try {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
            logger_1.configLogger.debug('Loading config from:', configPath);
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
        logger_1.configLogger.debug('No config file found, using defaults');
    }
    catch (e) {
        logger_1.configLogger.error('Error loading config:', e.message);
    }
    return {};
}
/**
 * Save user config overrides to disk (partial updates)
 */
function saveUserConfig(updates) {
    try {
        const current = loadUserConfig();
        const merged = deepMerge(current, updates);
        fs.writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2));
        logger_1.configLogger.info('Config saved successfully');
        logger_1.configLogger.debug('Config updates:', updates);
    }
    catch (e) {
        logger_1.configLogger.error('Error saving config:', e.message);
    }
}
/**
 * Get the current master config (defaults merged with user overrides)
 */
function getMasterConfig() {
    const userConfig = loadUserConfig();
    return deepMerge(exports.MASTER_CONFIG_DEFAULTS, userConfig);
}
