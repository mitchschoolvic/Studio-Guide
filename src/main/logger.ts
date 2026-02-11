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

import log from 'electron-log';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

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
    FILE_LEVEL: 'info' as const,
    CONSOLE_LEVEL: 'debug' as const,
} as const;

// ============================================================================
// Logger Setup
// ============================================================================

/**
 * Ensures the log directory exists, creating it if necessary.
 */
function ensureLogDirectory(): string {
    const userDataPath = app.getPath('userData');
    const logDir = path.join(userDataPath, LOG_CONFIG.LOG_DIR);
    
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    return logDir;
}

/**
 * Generates a timestamped log filename for the current session.
 */
function generateLogFileName(): string {
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
function cleanupOldLogs(logDir: string, maxFiles: number): void {
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
            } catch (e) {
                // Silently ignore deletion errors
            }
        });
    } catch (e) {
        // Silently ignore cleanup errors
    }
}

/**
 * Formats log messages with consistent structure.
 * Returns an array of message parts for electron-log format function.
 */
function formatLogMessage({ message }: { data: any[], level: string, message: log.LogMessage }): string[] {
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
export function initializeLogger(): void {
    const logDir = ensureLogDirectory();
    const logFileName = generateLogFileName();
    const logFilePath = path.join(logDir, logFileName);
    
    // Clean up old log files
    cleanupOldLogs(logDir, LOG_CONFIG.MAX_FILES);
    
    // Configure file transport
    log.transports.file.resolvePathFn = () => logFilePath;
    log.transports.file.level = LOG_CONFIG.FILE_LEVEL;
    log.transports.file.maxSize = LOG_CONFIG.MAX_FILE_SIZE;
    log.transports.file.format = formatLogMessage;
    
    // Configure console transport
    log.transports.console.level = LOG_CONFIG.CONSOLE_LEVEL;
    log.transports.console.format = formatLogMessage;
    
    // Handle uncaught exceptions
    log.errorHandler.startCatching({
        showDialog: false,
        onError: ({ error, processType }) => {
            logger.error(`Uncaught exception in ${processType}:`, error);
        }
    });
    
    // Log startup information
    logger.info('='.repeat(80));
    logger.info('APPLICATION STARTING');
    logger.info('='.repeat(80));
    logger.info(`Version: ${app.getVersion()}`);
    logger.info(`Platform: ${process.platform} ${process.arch}`);
    logger.info(`Electron: ${process.versions.electron}`);
    logger.info(`Node: ${process.versions.node}`);
    logger.info(`Chrome: ${process.versions.chrome}`);
    logger.info(`Log file: ${logFilePath}`);
    logger.info(`User data path: ${app.getPath('userData')}`);
    logger.info('='.repeat(80));
}

/**
 * Logs application shutdown with summary.
 */
export function logShutdown(): void {
    logger.info('='.repeat(80));
    logger.info('APPLICATION SHUTTING DOWN');
    logger.info('='.repeat(80));
}

// ============================================================================
// Logger Instances
// ============================================================================

/**
 * Main application logger.
 * Use this for general application logging.
 */
export const logger = log.scope('Main');

/**
 * Creates a scoped logger for a specific module.
 * 
 * @example
 * const ipcLogger = createScopedLogger('IPC');
 * ipcLogger.info('Handling request:', data);
 */
export function createScopedLogger(scope: string): log.LogFunctions {
    return log.scope(scope);
}

// ============================================================================
// Pre-configured Module Loggers
// ============================================================================

/** Logger for IPC (Inter-Process Communication) events */
export const ipcLogger = log.scope('IPC');

/** Logger for window management */
export const windowLogger = log.scope('Window');

/** Logger for configuration operations */
export const configLogger = log.scope('Config');

/** Logger for email/alert operations */
export const alertLogger = log.scope('Alert');

/** Logger for hardware operations (displays, cameras) */
export const hardwareLogger = log.scope('Hardware');

/** Logger for tracking data operations */
export const trackingLogger = log.scope('Tracking');

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Gets the path to the current log file.
 */
export function getLogFilePath(): string {
    return log.transports.file.getFile()?.path || '';
}

/**
 * Gets the log directory path.
 */
export function getLogDirectory(): string {
    return path.join(app.getPath('userData'), LOG_CONFIG.LOG_DIR);
}

/**
 * Exposes logging via IPC for renderer process.
 * Call this to set up IPC handlers for frontend logging.
 */
export function setupRendererLogging(ipcMain: Electron.IpcMain): void {
    const rendererLogger = log.scope('Renderer');
    
    ipcMain.on('log-message', (_event, { level, message, data }) => {
        const logFn = rendererLogger[level as keyof log.LogFunctions];
        if (typeof logFn === 'function') {
            (logFn as Function)(message, ...(data || []));
        }
    });
}

// ============================================================================
// Export Types
// ============================================================================

export type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    scope: string;
    message: string;
    data?: unknown[];
}

// Default export for convenience
export default logger;
