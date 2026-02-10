"use strict";
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
const electron_1 = require("electron");
const path = __importStar(require("path"));
const config_manager_1 = require("./config-manager");
const logger_1 = require("./logger");
let mainWindow = null;
let secondaryWindow = null;
// --- Window Management ---
function createWindow() {
    logger_1.windowLogger.info('Creating main window');
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#000',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (electron_1.app.isPackaged) {
        const indexPath = path.join(process.resourcesPath, 'frontend', 'dist', 'index.html');
        logger_1.windowLogger.info('Loading packaged frontend:', indexPath);
        mainWindow.loadFile(indexPath);
    }
    else {
        logger_1.windowLogger.info('Loading development server: http://localhost:5173');
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    mainWindow.on('closed', () => {
        logger_1.windowLogger.info('Main window closed');
        mainWindow = null;
    });
    logger_1.windowLogger.info('Main window created successfully');
}
function createSecondaryWindow(displayId) {
    logger_1.windowLogger.info('Toggle secondary window requested for display:', displayId);
    if (secondaryWindow && !secondaryWindow.isDestroyed()) {
        logger_1.windowLogger.info('Closing existing secondary window');
        secondaryWindow.close();
        secondaryWindow = null;
        return;
    }
    const displays = electron_1.screen.getAllDisplays();
    const targetDisplay = displays.find(d => d.id === displayId) || displays[0];
    logger_1.windowLogger.info('Creating secondary window on display:', { displayId: targetDisplay.id, bounds: targetDisplay.bounds });
    secondaryWindow = new electron_1.BrowserWindow({
        x: targetDisplay.bounds.x,
        y: targetDisplay.bounds.y,
        width: targetDisplay.bounds.width,
        height: targetDisplay.bounds.height,
        fullscreen: true,
        backgroundColor: '#000',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (electron_1.app.isPackaged) {
        mainWindow?.loadFile(path.join(process.resourcesPath, 'frontend', 'dist', 'index.html'), { query: { mode: 'secondary' } });
    }
    else {
        secondaryWindow.loadURL('http://localhost:5173?mode=secondary');
    }
    secondaryWindow.on('closed', () => {
        logger_1.windowLogger.info('Secondary window closed');
        secondaryWindow = null;
    });
    logger_1.windowLogger.info('Secondary window created successfully');
}
// --- IPC Handlers ---
// 1. Data Relay (Replaces ZMQ)
electron_1.ipcMain.on('broadcast-tracking-data', (event, data) => {
    // Forward to all windows except sender (or all, doesn't matter much for React refs)
    // Primarily we want the secondary window to get this.
    if (secondaryWindow && !secondaryWindow.isDestroyed()) {
        secondaryWindow.webContents.send('tracking-update', data);
    }
    // Also send back to main window if needed, but main window generated it.
});
// 2. Hardware / OS
electron_1.ipcMain.handle('get-displays', () => {
    logger_1.hardwareLogger.debug('Fetching display information');
    const displays = electron_1.screen.getAllDisplays().map((d) => ({
        id: d.id,
        label: d.label,
        bounds: d.bounds
    }));
    logger_1.hardwareLogger.debug('Found displays:', displays.length);
    return displays;
});
electron_1.ipcMain.handle('toggle-secondary-window', (event, displayId) => {
    logger_1.ipcLogger.info('IPC: toggle-secondary-window', { displayId });
    createSecondaryWindow(displayId);
    return !!secondaryWindow;
});
// 3. Config
electron_1.ipcMain.handle('get-camera-config', () => {
    logger_1.configLogger.debug('IPC: get-camera-config');
    return (0, config_manager_1.loadUserConfig)();
});
electron_1.ipcMain.handle('save-camera-config', (event, config) => {
    logger_1.configLogger.info('IPC: save-camera-config');
    return (0, config_manager_1.saveUserConfig)(config);
});
electron_1.ipcMain.handle('open-config-location', () => {
    logger_1.configLogger.info('IPC: open-config-location');
    electron_1.shell.showItemInFolder((0, config_manager_1.getConfigPath)());
});
// Add handler to open log directory
electron_1.ipcMain.handle('open-log-location', () => {
    const logDir = (0, logger_1.getLogDirectory)();
    logger_1.configLogger.info('IPC: open-log-location', { logDir });
    electron_1.shell.openPath(logDir);
});
// 4. Email Alerts
const http_1 = require("http");
const https_1 = require("https");
const url_1 = require("url");
electron_1.ipcMain.handle('send-email-alert', async (_event, { endpointUrl, htmlBody, subject }) => {
    logger_1.alertLogger.info('Sending email alert', { endpoint: endpointUrl, subject });
    return new Promise((resolve) => {
        try {
            const url = new url_1.URL(endpointUrl);
            const isHttps = url.protocol === 'https:';
            const requestLib = isHttps ? https_1.request : http_1.request;
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Content-Length': Buffer.byteLength(htmlBody),
                    ...(subject ? { 'Subject': subject } : {})
                }
            };
            logger_1.alertLogger.debug('Request options:', options);
            const req = requestLib(endpointUrl, options, (res) => {
                const { statusCode } = res;
                if (statusCode && statusCode >= 200 && statusCode < 300) {
                    logger_1.alertLogger.info('Email alert sent successfully', { statusCode });
                    resolve({ success: true });
                }
                else {
                    logger_1.alertLogger.error('Email alert HTTP error', { statusCode });
                    res.resume(); // Consume response data to free up memory
                    resolve({ success: false, error: `HTTP ${statusCode}` });
                }
            });
            req.on('error', (e) => {
                logger_1.alertLogger.error('Email alert request error', { error: e.message });
                resolve({ success: false, error: e.message });
            });
            req.write(htmlBody);
            req.end();
        }
        catch (error) {
            logger_1.alertLogger.error('Email alert unexpected error', { error: error.message });
            resolve({ success: false, error: error.message });
        }
    });
});
// Legacy stubs to prevent frontend crashes during refactor
electron_1.ipcMain.handle('update-tracking-config', () => { });
electron_1.ipcMain.handle('get-master-config', () => ({}));
// --- Application Lifecycle ---
electron_1.app.whenReady().then(() => {
    // Initialize logging first
    (0, logger_1.initializeLogger)();
    // Setup renderer process logging bridge
    (0, logger_1.setupRendererLogging)(electron_1.ipcMain);
    logger_1.logger.info('Application ready, creating main window');
    createWindow();
    electron_1.app.on('activate', () => {
        logger_1.logger.info('App activated');
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            logger_1.logger.info('No windows open, creating main window');
            createWindow();
        }
    });
});
electron_1.app.on('before-quit', () => {
    logger_1.logger.info('Application before-quit event');
    (0, logger_1.logShutdown)();
});
electron_1.app.on('window-all-closed', () => {
    logger_1.logger.info('All windows closed');
    if (process.platform !== 'darwin') {
        logger_1.logger.info('Non-macOS platform, quitting app');
        electron_1.app.quit();
    }
});
