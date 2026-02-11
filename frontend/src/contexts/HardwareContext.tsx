import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { triggerAlert, DeviceInfo } from '../services/alertService';
import { useConfig } from './ConfigContext';

// Helper to get device name from cameras list
function getDeviceName(cameras: MediaDeviceInfo[], deviceId: string): string {
    const device = cameras.find(c => c.deviceId === deviceId);
    return device?.label || deviceId || 'Unknown Device';
}

interface HardwareContextValue {
    // Cameras
    cameras: MediaDeviceInfo[];
    selectedCameraId: string;
    setSelectedCameraId: (id: string) => void;
    backendCameraIndex: number;
    setBackendCameraIndex: (index: number) => void;

    // Auto-reconnect
    autoReconnectCamera: boolean;
    setAutoReconnectCamera: (enabled: boolean) => void;
    cameraReconnectTrigger: number; // Increments to force stream re-acquisition
    notifyCameraDisconnected: () => void; // Call when camera stream ends

    // Displays
    displays: any[];
    selectedDisplayId: number;
    setSelectedDisplayId: (id: number) => void;
    isSecondaryOpen: boolean;
    toggleSecondary: () => Promise<void>;
}

const HardwareContext = createContext<HardwareContextValue | null>(null);

export function HardwareProvider({ children }: { children: ReactNode }) {
    const { settings } = useConfig();
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    const [backendCameraIndex, setBackendCameraIndex] = useState<number>(0);
    const [autoReconnectCamera, setAutoReconnectCameraState] = useState<boolean>(true);
    const [cameraReconnectTrigger, setCameraReconnectTrigger] = useState<number>(0);

    // Track the last user-selected camera ID and label for reconnection
    const lastSelectedCameraIdRef = useRef<string>('');
    const lastSelectedCameraLabelRef = useRef<string>('');
    // Track if camera was disconnected (state to trigger polling effect)
    const [isCameraDisconnected, setIsCameraDisconnected] = useState<boolean>(false);
    
    // Debounce refs to prevent duplicate alerts from rapid devicechange events
    const disconnectAlertSentRef = useRef<boolean>(false);
    const connectAlertSentRef = useRef<boolean>(false);
    const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [displays, setDisplays] = useState<any[]>([]);
    const [selectedDisplayId, setSelectedDisplayId] = useState<number>(0);
    const [isSecondaryOpen, setIsSecondaryOpen] = useState(false);

    // Initial Load
    useEffect(() => {
        // Enumerate Cameras
        navigator.mediaDevices.enumerateDevices().then(devices => {
            setCameras(devices.filter(d => d.kind === 'videoinput'));
        });

        if (!window.electronAPI) return;

        // Get Displays
        window.electronAPI.getDisplays().then(displayList => {
            setDisplays(displayList);
            if (displayList.length > 0) {
                const external = displayList.find(d => d.bounds.x !== 0 || d.bounds.y !== 0);
                setSelectedDisplayId(external ? external.id : displayList[0].id);
            }
        });

        // Get Persisted Hardware Config
        window.electronAPI.getCameraConfig().then(config => {
            if (config.frontendCameraId) {
                setSelectedCameraId(config.frontendCameraId);
                lastSelectedCameraIdRef.current = config.frontendCameraId;
            }
            if (config.backendCameraIndex !== undefined) setBackendCameraIndex(config.backendCameraIndex);
            if (config.autoReconnectCamera !== undefined) setAutoReconnectCameraState(config.autoReconnectCamera);
        });
    }, []);

    // Device change monitoring for auto-reconnect
    useEffect(() => {
        const handleDeviceChange = async () => {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setCameras(videoDevices);

            // Check if the selected camera is currently connected
            const selectedIsConnected = videoDevices.find(d => d.deviceId === selectedCameraId);
            const lastSelectedIsConnected = videoDevices.find(d => d.deviceId === lastSelectedCameraIdRef.current);

            // Mark as disconnected if selected camera is gone
            // Use debounce flag to prevent duplicate alerts from rapid devicechange events
            if (!selectedIsConnected && selectedCameraId && !disconnectAlertSentRef.current) {
                disconnectAlertSentRef.current = true; // Mark alert as sent
                connectAlertSentRef.current = false;   // Reset connect flag for future reconnection
                
                const deviceName = lastSelectedCameraLabelRef.current || 'Unknown USB Camera';
                const deviceInfo: DeviceInfo = {
                    deviceId: selectedCameraId,
                    label: deviceName
                };
                
                // Log to main process for persistent logging
                window.electronAPI?.log.warn(`USB camera disconnected: "${deviceName}" (ID: ${selectedCameraId})`);
                console.log('[HardwareContext] Camera disconnected:', deviceName, selectedCameraId);
                
                setIsCameraDisconnected(true);
                triggerAlert('camera_disconnected', settings.alerts, deviceInfo);
            }

            // Auto-reconnect logic: if the last selected camera reappears
            // Use debounce flag to prevent duplicate alerts
            if (lastSelectedCameraIdRef.current && isCameraDisconnected && !connectAlertSentRef.current) {
                if (lastSelectedIsConnected) {
                    connectAlertSentRef.current = true;    // Mark alert as sent
                    disconnectAlertSentRef.current = false; // Reset disconnect flag for future disconnection
                    
                    const deviceName = lastSelectedIsConnected.label || lastSelectedCameraLabelRef.current || 'Unknown USB Camera';
                    const deviceInfo: DeviceInfo = {
                        deviceId: lastSelectedCameraIdRef.current,
                        label: deviceName
                    };
                    
                    // Log to main process for persistent logging
                    window.electronAPI?.log.info(`USB camera connected: "${deviceName}" (ID: ${lastSelectedCameraIdRef.current})`);
                    console.log('[HardwareContext] Camera reconnected (detected):', deviceName, lastSelectedCameraIdRef.current);

                    // Trigger alert regardless of auto-reconnect setting, as the device physically reappeared
                    triggerAlert('camera_connected', settings.alerts, deviceInfo);

                    if (autoReconnectCamera) {
                        console.log('[HardwareContext] Auto-reconnecting...');
                        setIsCameraDisconnected(false);

                        // If it's the same ID, increment trigger to force re-acquisition
                        if (selectedCameraId === lastSelectedCameraIdRef.current) {
                            setCameraReconnectTrigger(prev => prev + 1);
                        } else {
                            setSelectedCameraId(lastSelectedCameraIdRef.current);
                        }
                    }
                }
            }
        };

        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    }, [autoReconnectCamera, selectedCameraId, isCameraDisconnected, settings.alerts]);

    // Polling-based reconnection (more reliable fallback for Electron)
    useEffect(() => {
        if (!autoReconnectCamera || !isCameraDisconnected || !lastSelectedCameraIdRef.current) {
            return;
        }

        console.log('[HardwareContext] Starting reconnection polling...');

        const pollInterval = setInterval(async () => {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setCameras(videoDevices);

            const lastSelectedIsConnected = videoDevices.find(d => d.deviceId === lastSelectedCameraIdRef.current);

            if (lastSelectedIsConnected) {
                console.log('[HardwareContext] Polling detected camera reconnection:', lastSelectedCameraIdRef.current);
                setIsCameraDisconnected(false);

                // Force re-acquisition
                setCameraReconnectTrigger(prev => prev + 1);
            }
        }, 2000); // Poll every 2 seconds

        return () => {
            console.log('[HardwareContext] Stopping reconnection polling');
            clearInterval(pollInterval);
        };
    }, [autoReconnectCamera, isCameraDisconnected]); // Starts when disconnected, stops when reconnected

    const handleCameraIdChange = useCallback((id: string) => {
        setSelectedCameraId(id);
        // Store as the last user-selected camera for auto-reconnect
        if (id) {
            lastSelectedCameraIdRef.current = id;
            // Also store the label for logging purposes
            const deviceName = getDeviceName(cameras, id);
            lastSelectedCameraLabelRef.current = deviceName;
            window.electronAPI?.log.info(`Camera selected: "${deviceName}" (ID: ${id})`);
        }
        window.electronAPI?.saveCameraConfig({ frontendCameraId: id });
    }, [cameras]);

    const handleBackendIndexChange = useCallback((index: number) => {
        setBackendCameraIndex(index);
        window.electronAPI?.saveCameraConfig({ backendCameraIndex: index });
    }, []);

    const handleAutoReconnectChange = useCallback((enabled: boolean) => {
        setAutoReconnectCameraState(enabled);
        window.electronAPI?.saveCameraConfig({ autoReconnectCamera: enabled });
    }, []);

    const handleCameraDisconnected = useCallback(() => {
        console.log('[HardwareContext] Camera disconnected notification received');
        setIsCameraDisconnected(true);
    }, []);

    const toggleSecondary = useCallback(async () => {
        if (!window.electronAPI) return;
        const isOpen = await window.electronAPI.toggleSecondaryWindow(selectedDisplayId);
        setIsSecondaryOpen(isOpen);
    }, [selectedDisplayId]);


    const value: HardwareContextValue = {
        cameras,
        selectedCameraId,
        setSelectedCameraId: handleCameraIdChange,
        backendCameraIndex,
        setBackendCameraIndex: handleBackendIndexChange,
        autoReconnectCamera,
        setAutoReconnectCamera: handleAutoReconnectChange,
        cameraReconnectTrigger,
        notifyCameraDisconnected: handleCameraDisconnected,
        displays,
        selectedDisplayId,
        setSelectedDisplayId,
        isSecondaryOpen,
        toggleSecondary
    };

    return (
        <HardwareContext.Provider value={value}>
            {children}
        </HardwareContext.Provider>
    );
}

export function useHardware() {
    const context = useContext(HardwareContext);
    if (!context) throw new Error('useHardware must be used within HardwareProvider');
    return context;
}
