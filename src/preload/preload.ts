import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { AppConfig } from '../shared/types';

// Log level type for type safety
type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly';

contextBridge.exposeInMainWorld('electronAPI', {
    // Data Relay
    broadcastTrackingData: (data: any) => ipcRenderer.send('broadcast-tracking-data', data),

    onTrackingUpdate: (callback: (data: any) => void) => {
        const subscription = (_event: IpcRendererEvent, value: any) => callback(value);
        ipcRenderer.on('tracking-update', subscription);
        return () => ipcRenderer.removeListener('tracking-update', subscription);
    },

    // Window Management
    getDisplays: () => ipcRenderer.invoke('get-displays'),
    toggleSecondaryWindow: (displayId: number) => ipcRenderer.invoke('toggle-secondary-window', displayId),

    // Persistence
    getCameraConfig: () => ipcRenderer.invoke('get-camera-config'),
    saveCameraConfig: (config: Partial<AppConfig>) => ipcRenderer.invoke('save-camera-config', config),
    openConfigLocation: () => ipcRenderer.invoke('open-config-location'),
    openLogLocation: () => ipcRenderer.invoke('open-log-location'),

    // Email Alerts
    sendEmailAlert: (endpointUrl: string, htmlBody: string, subject?: string) =>
        ipcRenderer.invoke('send-email-alert', { endpointUrl, htmlBody, subject }),

    // Logging - allows renderer to send logs to main process file
    log: {
        error: (message: string, ...data: any[]) => 
            ipcRenderer.send('log-message', { level: 'error' as LogLevel, message, data }),
        warn: (message: string, ...data: any[]) => 
            ipcRenderer.send('log-message', { level: 'warn' as LogLevel, message, data }),
        info: (message: string, ...data: any[]) => 
            ipcRenderer.send('log-message', { level: 'info' as LogLevel, message, data }),
        debug: (message: string, ...data: any[]) => 
            ipcRenderer.send('log-message', { level: 'debug' as LogLevel, message, data }),
    },

    // Legacy Stubs
    updateTrackingConfig: (config: any) => ipcRenderer.invoke('update-tracking-config', config),
    getMasterConfig: () => ipcRenderer.invoke('get-master-config'),
});
