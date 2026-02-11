import { app, BrowserWindow, ipcMain, screen, shell, Display } from 'electron';
import * as path from 'path';
import { AppConfig } from '../shared/types';
import { loadUserConfig, saveUserConfig, getConfigPath } from './config-manager';
import {
    initializeLogger,
    logShutdown,
    logger,
    windowLogger,
    ipcLogger,
    alertLogger,
    hardwareLogger,
    trackingLogger,
    configLogger,
    setupRendererLogging,
    getLogDirectory
} from './logger';

let mainWindow: BrowserWindow | null = null;
let secondaryWindow: BrowserWindow | null = null;

// --- Window Management ---
function createWindow() {
    windowLogger.info('Creating main window');
    
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#000',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (app.isPackaged) {
        const indexPath = path.join(process.resourcesPath, 'frontend', 'dist', 'index.html');
        windowLogger.info('Loading packaged frontend:', indexPath);
        mainWindow.loadFile(indexPath);
    } else {
        windowLogger.info('Loading development server: http://localhost:5173');
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    
    mainWindow.on('closed', () => {
        windowLogger.info('Main window closed');
        mainWindow = null;
    });
    
    windowLogger.info('Main window created successfully');
}

function createSecondaryWindow(displayId: number) {
    windowLogger.info('Toggle secondary window requested for display:', displayId);
    
    if (secondaryWindow && !secondaryWindow.isDestroyed()) {
        windowLogger.info('Closing existing secondary window');
        secondaryWindow.close();
        secondaryWindow = null;
        return;
    }

    const displays = screen.getAllDisplays();
    const targetDisplay = displays.find(d => d.id === displayId) || displays[0];
    windowLogger.info('Creating secondary window on display:', { displayId: targetDisplay.id, bounds: targetDisplay.bounds });

    secondaryWindow = new BrowserWindow({
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

    if (app.isPackaged) {
        mainWindow?.loadFile(path.join(process.resourcesPath, 'frontend', 'dist', 'index.html'), { query: { mode: 'secondary' } });
    } else {
        secondaryWindow.loadURL('http://localhost:5173?mode=secondary');
    }

    secondaryWindow.on('closed', () => {
        windowLogger.info('Secondary window closed');
        secondaryWindow = null;
    });
    
    windowLogger.info('Secondary window created successfully');
}

// --- IPC Handlers ---

// 1. Data Relay (Replaces ZMQ)
ipcMain.on('broadcast-tracking-data', (event, data) => {
    // Forward to all windows except sender (or all, doesn't matter much for React refs)
    // Primarily we want the secondary window to get this.
    if (secondaryWindow && !secondaryWindow.isDestroyed()) {
        secondaryWindow.webContents.send('tracking-update', data);
    }
    // Also send back to main window if needed, but main window generated it.
});

// 2. Hardware / OS
ipcMain.handle('get-displays', () => {
    hardwareLogger.debug('Fetching display information');
    const displays = screen.getAllDisplays().map((d: Display) => ({
        id: d.id,
        label: d.label,
        bounds: d.bounds
    }));
    hardwareLogger.debug('Found displays:', displays.length);
    return displays;
});

ipcMain.handle('toggle-secondary-window', (event, displayId: number) => {
    ipcLogger.info('IPC: toggle-secondary-window', { displayId });
    createSecondaryWindow(displayId);
    return !!secondaryWindow;
});

// 3. Config
ipcMain.handle('get-camera-config', () => {
    configLogger.debug('IPC: get-camera-config');
    return loadUserConfig();
});
ipcMain.handle('save-camera-config', (event, config: Partial<AppConfig>) => {
    configLogger.info('IPC: save-camera-config');
    return saveUserConfig(config);
});
ipcMain.handle('open-config-location', () => {
    configLogger.info('IPC: open-config-location');
    shell.showItemInFolder(getConfigPath());
});

// Add handler to open log directory
ipcMain.handle('open-log-location', () => {
    const logDir = getLogDirectory();
    configLogger.info('IPC: open-log-location', { logDir });
    shell.openPath(logDir);
});

// 4. Email Alerts
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { URL } from 'url';

ipcMain.handle('send-email-alert', async (_event, { endpointUrl, htmlBody, subject }: { endpointUrl: string, htmlBody: string, subject?: string }) => {
    alertLogger.info('Sending email alert', { endpoint: endpointUrl, subject });
    
    return new Promise((resolve) => {
        try {
            const url = new URL(endpointUrl);
            const isHttps = url.protocol === 'https:';
            const requestLib = isHttps ? httpsRequest : httpRequest;

            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Content-Length': Buffer.byteLength(htmlBody),
                    ...(subject ? { 'Subject': subject } : {})
                }
            };

            alertLogger.debug('Request options:', options);

            const req = requestLib(endpointUrl, options, (res) => {
                const { statusCode } = res;
                if (statusCode && statusCode >= 200 && statusCode < 300) {
                    alertLogger.info('Email alert sent successfully', { statusCode });
                    resolve({ success: true });
                } else {
                    alertLogger.error('Email alert HTTP error', { statusCode });
                    res.resume(); // Consume response data to free up memory
                    resolve({ success: false, error: `HTTP ${statusCode}` });
                }
            });

            req.on('error', (e) => {
                alertLogger.error('Email alert request error', { error: e.message });
                resolve({ success: false, error: e.message });
            });

            req.write(htmlBody);
            req.end();

        } catch (error: any) {
            alertLogger.error('Email alert unexpected error', { error: error.message });
            resolve({ success: false, error: error.message });
        }
    });
});

// Legacy stubs to prevent frontend crashes during refactor
ipcMain.handle('update-tracking-config', () => { });
ipcMain.handle('get-master-config', () => ({}));

// --- Application Lifecycle ---
app.whenReady().then(() => {
    // Initialize logging first
    initializeLogger();
    
    // Setup renderer process logging bridge
    setupRendererLogging(ipcMain);
    
    logger.info('Application ready, creating main window');
    createWindow();
    
    app.on('activate', () => {
        logger.info('App activated');
        if (BrowserWindow.getAllWindows().length === 0) {
            logger.info('No windows open, creating main window');
            createWindow();
        }
    });
});

app.on('before-quit', () => {
    logger.info('Application before-quit event');
    logShutdown();
});

app.on('window-all-closed', () => {
    logger.info('All windows closed');
    if (process.platform !== 'darwin') {
        logger.info('Non-macOS platform, quitting app');
        app.quit();
    }
});
