"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Data Relay
    broadcastTrackingData: (data) => electron_1.ipcRenderer.send('broadcast-tracking-data', data),
    onTrackingUpdate: (callback) => {
        const subscription = (_event, value) => callback(value);
        electron_1.ipcRenderer.on('tracking-update', subscription);
        return () => electron_1.ipcRenderer.removeListener('tracking-update', subscription);
    },
    // Window Management
    getDisplays: () => electron_1.ipcRenderer.invoke('get-displays'),
    toggleSecondaryWindow: (displayId) => electron_1.ipcRenderer.invoke('toggle-secondary-window', displayId),
    // Persistence
    getCameraConfig: () => electron_1.ipcRenderer.invoke('get-camera-config'),
    saveCameraConfig: (config) => electron_1.ipcRenderer.invoke('save-camera-config', config),
    openConfigLocation: () => electron_1.ipcRenderer.invoke('open-config-location'),
    openLogLocation: () => electron_1.ipcRenderer.invoke('open-log-location'),
    // Email Alerts
    sendEmailAlert: (endpointUrl, htmlBody, subject) => electron_1.ipcRenderer.invoke('send-email-alert', { endpointUrl, htmlBody, subject }),
    // Logging - allows renderer to send logs to main process file
    log: {
        error: (message, ...data) => electron_1.ipcRenderer.send('log-message', { level: 'error', message, data }),
        warn: (message, ...data) => electron_1.ipcRenderer.send('log-message', { level: 'warn', message, data }),
        info: (message, ...data) => electron_1.ipcRenderer.send('log-message', { level: 'info', message, data }),
        debug: (message, ...data) => electron_1.ipcRenderer.send('log-message', { level: 'debug', message, data }),
    },
    // Legacy Stubs
    updateTrackingConfig: (config) => electron_1.ipcRenderer.invoke('update-tracking-config', config),
    getMasterConfig: () => electron_1.ipcRenderer.invoke('get-master-config'),
});
