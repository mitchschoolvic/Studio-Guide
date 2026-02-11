import { CAMERA_DEFAULTS, MAP_DEFAULTS, PROCESSING_DEFAULTS } from '../../src/shared/constants';

/**
 * Frontend Configuration Constants
 * 
 * NOTE: The canonical source of config is now Electron's Master Config,
 * accessible via window.electronAPI.getMasterConfig().
 * 
 * These constants are used for:
 * - Fallback values when Electron API not available
 * - UI-only constants that don't need syncing
 * 
 * For values that MUST match Python (FOV, cam dimensions), 
 * use the Master Config from Electron instead.
 */
export const CONFIG = {
    // UI constraints
    MAX_TRACKED_FACES: PROCESSING_DEFAULTS.MAX_FACES,
} as const;
