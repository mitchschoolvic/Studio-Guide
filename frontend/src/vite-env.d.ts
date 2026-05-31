/// <reference types="vite/client" />

// Worker module declarations
declare module '*?worker' {
    const workerConstructor: {
        new(): Worker;
    };
    export default workerConstructor;
}

declare module '*?worker&inline' {
    const workerConstructor: {
        new(): Worker;
    };
    export default workerConstructor;
}

declare module '*?worker&url' {
    const workerUrl: string;
    export default workerUrl;
}

// Electron API exposed via preload
interface ElectronAPI {
    broadcastTrackingData: (data: any) => void;
    onTrackingUpdate: (callback: (data: any) => void) => () => void;
    getDisplays: () => Promise<any[]>;
    toggleSecondaryWindow: (displayId: number) => Promise<boolean>;
    sleepDisplays: () => Promise<import('../../../src/shared/types').MonitorSleepResult>;
    setDisplaySleepPrevented: (prevented: boolean) => Promise<boolean>;
    getCameraConfig: () => Promise<any>;
    saveCameraConfig: (config: any) => Promise<void>;
    openConfigLocation: () => Promise<void>;
    openLogLocation: () => Promise<void>;
    sendEmailAlert: (endpointUrl: string, htmlBody: string, subject?: string) => Promise<any>;

    // Standby / Device Monitoring
    selectStandbyImage: () => Promise<{ success: boolean; imagePath?: string; error?: string }>;
    getStandbyImage: () => Promise<string | null>;
    clearStandbyImage: () => Promise<{ success: boolean; error?: string }>;
    restartPingService: () => Promise<void>;
    pingSingleDevice: (ip: string) => Promise<boolean>;
    onDeviceStatusUpdate: (callback: (statuses: import('../../../src/shared/types').DeviceStatus[]) => void) => () => void;

    // Logging
    log: {
        error: (message: string, ...data: any[]) => void;
        warn: (message: string, ...data: any[]) => void;
        info: (message: string, ...data: any[]) => void;
        debug: (message: string, ...data: any[]) => void;
    };

    // Legacy
    updateTrackingConfig: (config: any) => Promise<void>;
    getMasterConfig: () => Promise<any>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

