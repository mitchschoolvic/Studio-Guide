"use strict";
/**
 * Logger Service
 *
 * Centralized logging infrastructure for the Skeleton Tracker application.
 * Provides structured logging with file rotation, multiple transports,
 * and context-aware log entries.
 *
 * Log files are stored in: ~/Library/Application Support/skeleton-tracker/logs/
 *
 * Features:
 * - Automatic log file rotation (max 5 files, 10MB each)
 * - Structured JSON format for machine parsing
 * - Human-readable console output
 * - Scoped loggers for different modules
 * - Uncaught exception and promise rejection handling
 * - Session-based log files with timestamps
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackingLogger = exports.hardwareLogger = exports.alertLogger = exports.configLogger = exports.windowLogger = exports.ipcLogger = exports.logger = void 0;
exports.initializeLogger = initializeLogger;
exports.logShutdown = logShutdown;
exports.createScopedLogger = createScopedLogger;
exports.getLogFilePath = getLogFilePath;
exports.getLogDirectory = getLogDirectory;
exports.setupRendererLogging = setupRendererLogging;
const electron_log_1 = __importDefault(require("electron-log"));
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// ============================================================================
// Configuration
// ============================================================================
const LOG_CONFIG = {
    // Directory for log files (relative to app.getPath('userData'))
    LOG_DIR: 'logs',
    // Maximum size of a single log file before rotation (in bytes)
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
    // Maximum number of rotated log files to keep
    MAX_FILES: 5,
    // Log levels: error, warn, info, verbose, debug, silly
    FILE_LEVEL: 'info',
    CONSOLE_LEVEL: 'debug',
};
// ============================================================================
// Logger Setup
// ============================================================================
/**
 * Ensures the log directory exists, creating it if necessary.
 */
function ensureLogDirectory() {
    const userDataPath = electron_1.app.getPath('userData');
    const logDir = path.join(userDataPath, LOG_CONFIG.LOG_DIR);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    return logDir;
}
/**
 * Generates a timestamped log filename for the current session.
 */
function generateLogFileName() {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, 19);
    return `app_${timestamp}.log`;
}
/**
 * Cleans up old log files, keeping only the most recent ones.
 */
function cleanupOldLogs(logDir, maxFiles) {
    try {
        const files = fs.readdirSync(logDir)
            .filter(f => f.startsWith('app_') && f.endsWith('.log'))
            .map(f => ({
            name: f,
            path: path.join(logDir, f),
            mtime: fs.statSync(path.join(logDir, f)).mtime.getTime()
        }))
            .sort((a, b) => b.mtime - a.mtime); // Newest first
        // Remove old files beyond maxFiles limit
        files.slice(maxFiles).forEach(file => {
            try {
                fs.unlinkSync(file.path);
            }
            catch (e) {
                // Silently ignore deletion errors
            }
        });
    }
    catch (e) {
        // Silently ignore cleanup errors
    }
}
/**
 * Formats log messages with consistent structure.
 * Returns an array of message parts for electron-log format function.
 */
function formatLogMessage({ message }) {
    const timestamp = message.date.toISOString();
    const level = message.level.toUpperCase().padEnd(5);
    const scope = message.scope ? `[${message.scope}]` : '';
    const data = message.data
        .map(item => {
        if (item instanceof Error) {
            return `${item.message}\n${item.stack}`;
        }
        if (typeof item === 'object') {
            return JSON.stringify(item, null, 2);
        }
        return String(item);
    })
        .join(' ');
    return [`${timestamp} | ${level} | ${scope.padEnd(20)} | ${data}`];
}
/**
 * Initializes the logger with proper configuration.
 * Must be called after app.whenReady() or when app path is available.
 */
function initializeLogger() {
    const logDir = ensureLogDirectory();
    const logFileName = generateLogFileName();
    const logFilePath = path.join(logDir, logFileName);
    // Clean up old log files
    cleanupOldLogs(logDir, LOG_CONFIG.MAX_FILES);
    // Configure file transport
    electron_log_1.default.transports.file.resolvePathFn = () => logFilePath;
    electron_log_1.default.transports.file.level = LOG_CONFIG.FILE_LEVEL;
    electron_log_1.default.transports.file.maxSize = LOG_CONFIG.MAX_FILE_SIZE;
    electron_log_1.default.transports.file.format = formatLogMessage;
    // Configure console transport
    electron_log_1.default.transports.console.level = LOG_CONFIG.CONSOLE_LEVEL;
    electron_log_1.default.transports.console.format = formatLogMessage;
    // Handle uncaught exceptions
    electron_log_1.default.errorHandler.startCatching({
        showDialog: false,
        onError: ({ error, processType }) => {
            exports.logger.error(`Uncaught exception in ${processType}:`, error);
        }
    });
    // Log startup information
    exports.logger.info('='.repeat(80));
    exports.logger.info('APPLICATION STARTING');
    exports.logger.info('='.repeat(80));
    exports.logger.info(`Version: ${electron_1.app.getVersion()}`);
    exports.logger.info(`Platform: ${process.platform} ${process.arch}`);
    exports.logger.info(`Electron: ${process.versions.electron}`);
    exports.logger.info(`Node: ${process.versions.node}`);
    exports.logger.info(`Chrome: ${process.versions.chrome}`);
    exports.logger.info(`Log file: ${logFilePath}`);
    exports.logger.info(`User data path: ${electron_1.app.getPath('userData')}`);
    exports.logger.info('='.repeat(80));
}
/**
 * Logs application shutdown with summary.
 */
function logShutdown() {
    exports.logger.info('='.repeat(80));
    exports.logger.info('APPLICATION SHUTTING DOWN');
    exports.logger.info('='.repeat(80));
}
// ============================================================================
// Logger Instances
// ============================================================================
/**
 * Main application logger.
 * Use this for general application logging.
 */
exports.logger = electron_log_1.default.scope('Main');
/**
 * Creates a scoped logger for a specific module.
 *
 * @example
 * const ipcLogger = createScopedLogger('IPC');
 * ipcLogger.info('Handling request:', data);
 */
function createScopedLogger(scope) {
    return electron_log_1.default.scope(scope);
}
// ============================================================================
// Pre-configured Module Loggers
// ============================================================================
/** Logger for IPC (Inter-Process Communication) events */
exports.ipcLogger = electron_log_1.default.scope('IPC');
/** Logger for window management */
exports.windowLogger = electron_log_1.default.scope('Window');
/** Logger for configuration operations */
exports.configLogger = electron_log_1.default.scope('Config');
/** Logger for email/alert operations */
exports.alertLogger = electron_log_1.default.scope('Alert');
/** Logger for hardware operations (displays, cameras) */
exports.hardwareLogger = electron_log_1.default.scope('Hardware');
/** Logger for tracking data operations */
exports.trackingLogger = electron_log_1.default.scope('Tracking');
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Gets the path to the current log file.
 */
function getLogFilePath() {
    return electron_log_1.default.transports.file.getFile()?.path || '';
}
/**
 * Gets the log directory path.
 */
function getLogDirectory() {
    return path.join(electron_1.app.getPath('userData'), LOG_CONFIG.LOG_DIR);
}
/**
 * Exposes logging via IPC for renderer process.
 * Call this to set up IPC handlers for frontend logging.
 */
function setupRendererLogging(ipcMain) {
    const rendererLogger = electron_log_1.default.scope('Renderer');
    ipcMain.on('log-message', (_event, { level, message, data }) => {
        const logFn = rendererLogger[level];
        if (typeof logFn === 'function') {
            logFn(message, ...(data || []));
        }
    });
}
// Default export for convenience
exports.default = exports.logger;
