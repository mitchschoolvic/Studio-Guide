import { app, BrowserWindow, ipcMain, screen, shell, dialog, Display, powerSaveBlocker } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AppConfig, StandbyConfig } from '../shared/types';
import { loadUserConfig, saveUserConfig, getConfigPath, getMasterConfig } from './config-manager';
import { PingService } from './ping-service';
import { sleepDisplays } from './monitor-sleep-service';
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
const pingService = new PingService();
let displaySleepBlockerId: number | null = null;

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

ipcMain.handle('sleep-displays', async () => {
    hardwareLogger.info('IPC: sleep-displays');
    const result = await sleepDisplays();

    if (!result.success) {
        hardwareLogger.warn('Display sleep request failed', result);
    }

    return result;
});

ipcMain.handle('set-display-sleep-prevented', (_event, prevented: boolean) => {
    hardwareLogger.info('IPC: set-display-sleep-prevented', { prevented });

    if (prevented) {
        if (displaySleepBlockerId === null || !powerSaveBlocker.isStarted(displaySleepBlockerId)) {
            displaySleepBlockerId = powerSaveBlocker.start('prevent-display-sleep');
        }
        return true;
    }

    if (displaySleepBlockerId !== null && powerSaveBlocker.isStarted(displaySleepBlockerId)) {
        powerSaveBlocker.stop(displaySleepBlockerId);
    }
    displaySleepBlockerId = null;
    return false;
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

// 5. Standby / Device Monitoring

// Select standby image via file dialog, copy to userData
ipcMain.handle('select-standby-image', async () => {
    configLogger.info('IPC: select-standby-image');
    if (!mainWindow) return { success: false, error: 'No main window' };

    const dialogResult: any = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Standby Image',
        filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }
        ],
        properties: ['openFile']
    });

    // Handle both old and new Electron dialog API shapes
    const filePaths = dialogResult.filePaths || dialogResult;
    const canceled = dialogResult.canceled ?? (filePaths.length === 0);

    if (canceled || filePaths.length === 0) {
        return { success: false, error: 'Cancelled' };
    }

    const sourcePath = filePaths[0];
    const ext = path.extname(sourcePath).toLowerCase();

    // Create standby-images directory in userData
    const standbyDir = path.join(app.getPath('userData'), 'standby-images');
    if (!fs.existsSync(standbyDir)) {
        fs.mkdirSync(standbyDir, { recursive: true });
    }

    // Copy image to userData with fixed name
    const destPath = path.join(standbyDir, `standby${ext}`);

    // Remove any previous standby images
    try {
        const existing = fs.readdirSync(standbyDir);
        for (const file of existing) {
            if (file.startsWith('standby.')) {
                fs.unlinkSync(path.join(standbyDir, file));
            }
        }
    } catch (e: any) {
        configLogger.warn('Failed to clean old standby images:', e.message);
    }

    try {
        fs.copyFileSync(sourcePath, destPath);
        configLogger.info('Standby image copied to:', destPath);
        return { success: true, imagePath: destPath };
    } catch (e: any) {
        configLogger.error('Failed to copy standby image:', e.message);
        return { success: false, error: e.message };
    }
});

// Load standby image as base64 data URL for renderer
ipcMain.handle('get-standby-image', async () => {
    const config = getMasterConfig();
    const imagePath = config.standby?.imagePath;

    if (!imagePath || !fs.existsSync(imagePath)) {
        return null;
    }

    try {
        const data = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        return `data:${mime};base64,${data.toString('base64')}`;
    } catch (e: any) {
        configLogger.error('Failed to load standby image:', e.message);
        return null;
    }
});

// Clear standby image
ipcMain.handle('clear-standby-image', async () => {
    configLogger.info('IPC: clear-standby-image');
    const standbyDir = path.join(app.getPath('userData'), 'standby-images');
    try {
        if (fs.existsSync(standbyDir)) {
            const files = fs.readdirSync(standbyDir);
            for (const file of files) {
                fs.unlinkSync(path.join(standbyDir, file));
            }
        }
        return { success: true };
    } catch (e: any) {
        configLogger.error('Failed to clear standby image:', e.message);
        return { success: false, error: e.message };
    }
});

// Restart ping service with current config
ipcMain.handle('restart-ping-service', () => {
    configLogger.info('IPC: restart-ping-service');
    startPingServiceFromConfig();
});

// Ping a single device immediately (used when adding a new device)
ipcMain.handle('ping-single-device', async (_event, ip: string) => {
    configLogger.info('IPC: ping-single-device', { ip });
    return new Promise<boolean>((resolve) => {
        const isWindows = process.platform === 'win32';
        const cmd = isWindows
            ? `ping -n 1 -w 2000 ${ip}`
            : `ping -c 1 -W 2 ${ip}`;

        const { exec } = require('child_process');
        exec(cmd, { timeout: 5000 }, (error: any) => {
            resolve(!error);
        });
    });
});

/**
 * Initialize or restart the ping service from saved config.
 */
function startPingServiceFromConfig(): void {
    const config = getMasterConfig();
    const standby = config.standby;

    if (!standby || !standby.enabled || !standby.devices || standby.devices.length === 0) {
        pingService.stop();
        // Send empty status to clear any warnings
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('device-status-update', []);
        }
        return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
        pingService.start(standby.devices, standby.pingIntervalSeconds, mainWindow, (statuses) => {
            // Persist statuses to config on each ping cycle
            saveUserConfig({ standby: { ...standby, lastKnownStatuses: statuses } });
        });
    }
}

// --- Application Lifecycle ---
app.whenReady().then(() => {
    // Initialize logging first
    initializeLogger();
    
    // Setup renderer process logging bridge
    setupRendererLogging(ipcMain);
    
    logger.info('Application ready, creating main window');
    createWindow();

    // Start ping service after window is ready
    if (mainWindow) {
        mainWindow.webContents.on('did-finish-load', () => {
            startPingServiceFromConfig();
        });
    }
    
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
