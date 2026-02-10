import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { TrackingConfig, HandZoneConfig, GestureZoneConfig } from '../types/schemas';
import { GESTURE_DEFAULTS, HAND_ZONE_DEFAULTS, GESTURE_ZONE_DEFAULTS } from '../../../src/shared/constants';

interface ConfigContextValue {
    // Settings
    settings: Partial<TrackingConfig>;
    updateSettings: (updates: Partial<TrackingConfig>) => void;
    updateZoneConfig: (updates: Partial<TrackingConfig['zone']>) => void;

    // Hand Zone Settings
    handZone: HandZoneConfig;
    updateHandZone: (updates: Partial<HandZoneConfig>) => void;

    // Gesture Zone Settings
    gestureZone: GestureZoneConfig;
    updateGestureZone: (updates: Partial<GestureZoneConfig>) => void;

    // Edit Mode State - UI specific but tied to config editing
    isHandEditMode: boolean;
    setHandEditMode: (active: boolean) => void;
    isGestureZoneEditMode: boolean;
    setGestureZoneEditMode: (active: boolean) => void;
    isZoneEditMode: boolean;
    setZoneEditMode: (active: boolean) => void;

    // Calibration
    calibration: { depthNear: number; depthFar: number };
    setCalibration: (cal: { depthNear: number; depthFar: number }) => void;
    setDepthNear: (value: number) => void;
    setDepthFar: (value: number) => void;

    // Debug
    showRawData: boolean;
    setShowRawData: (show: boolean) => void;
    showNeutralDot: boolean;
    setShowNeutralDot: (show: boolean) => void;
    showGestureDebug: boolean;
    setShowGestureDebug: (show: boolean) => void;
    showMarkers: boolean;
    setShowMarkers: (v: boolean) => void;
    showGrayscale: boolean;
    setShowGrayscale: (v: boolean) => void;
    duoFaceOffset: number; // Configurable spread for dual outlines

    // Loading State
    isLoading: boolean;
    masterConfig: Omit<TrackingConfig, 'camera'> & { camera: { width: number; height: number; fov: number } } | null;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

interface ConfigProviderProps {
    children: ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
    const [settings, setSettings] = useState<Partial<TrackingConfig>>({
        showMesh: false,
        showFps: false,
        eyeOffsetPx: 0,
        zone: {
            enabled: true,
            minDepthMm: 300,
            maxDepthMm: 2500,
            widthPercent: 0.8
        },
        handZone: { ...HAND_ZONE_DEFAULTS },
        gestureZone: { ...GESTURE_ZONE_DEFAULTS },
        gestures: GESTURE_DEFAULTS as any,
        gestureVisibility: {
            startRecording: true,
            stopRecording: true,
            startPlayback: true,
            stopPlayback: true
        }
    });

    const [isZoneEditMode, setZoneEditMode] = useState(false);
    const [isHandEditMode, setHandEditMode] = useState(false);
    const [isGestureZoneEditMode, setGestureZoneEditMode] = useState(false);
    const [calibration, setCalibration] = useState({ depthNear: 500, depthFar: 5000 });
    const [showRawData, setShowRawData] = useState(false);
    const [showNeutralDot, setShowNeutralDot] = useState(false);
    const [showMarkers, setShowMarkers] = useState(false);
    const [showGrayscale, setShowGrayscale] = useState(false);
    const [showGestureDebug, setShowGestureDebug] = useState(false);

    // Master Config State
    const [isLoading, setIsLoading] = useState(true);
    const [masterConfig, setMasterConfig] = useState<ConfigContextValue['masterConfig']>(null);

    // Flag to prevent auto-saving defaults before we load actual config
    const [isLoaded, setIsLoaded] = useState(false);

    const updateSettings = useCallback((updates: Partial<TrackingConfig>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    }, []);

    const updateZoneConfig = useCallback((updates: Partial<TrackingConfig['zone']>) => {
        setSettings(prev => ({
            ...prev,
            zone: { ...prev.zone!, ...updates }
        }));
    }, []);

    const updateHandZone = useCallback((updates: Partial<HandZoneConfig>) => {
        setSettings(prev => ({
            ...prev,
            handZone: { ...prev.handZone!, ...updates }
        }));
    }, []);

    const updateGestureZone = useCallback((updates: Partial<GestureZoneConfig>) => {
        setSettings(prev => ({
            ...prev,
            gestureZone: { ...prev.gestureZone!, ...updates }
        }));
    }, []);

    useEffect(() => {
        if (!window.electronAPI) return;

        window.electronAPI.getCameraConfig().then(config => {
            if (config.eyeOffset !== undefined) updateSettings({ eyeOffsetPx: config.eyeOffset });
            if (config.depthNear !== undefined && config.depthFar !== undefined) {
                setCalibration({ depthNear: config.depthNear, depthFar: config.depthFar });
            }
            if (config.zone) updateSettings({ zone: config.zone });
            if (config.handZone) updateSettings({ handZone: config.handZone });
            if (config.gestureZone) updateSettings({ gestureZone: config.gestureZone });
            if (config.overlay) updateSettings({ overlay: config.overlay });
            if (config.showMarkers !== undefined) setShowMarkers(config.showMarkers);
            if (config.showGrayscale !== undefined) setShowGrayscale(config.showGrayscale);
            if (config.gestures) updateSettings({ gestures: config.gestures });
            if (config.gestureVisibility) updateSettings({ gestureVisibility: config.gestureVisibility });
            if (config.alerts) updateSettings({ alerts: config.alerts });

            // Store the full master config (simplified type for now)
            // Ideally we would type the IPC return more strictly
            window.electronAPI.getMasterConfig().then((fullConfig: any) => {
                setMasterConfig({
                    camera: fullConfig.camera,
                    geometry: fullConfig.geometry,
                    network: fullConfig.network,
                    processing: fullConfig.processing,
                    // map configs
                    map: fullConfig.map
                } as any);

                setIsLoaded(true);
                setIsLoading(false);
            });
        });
    }, [updateSettings]);

    useEffect(() => {
        if (window.electronAPI && isLoaded) {
            window.electronAPI.updateTrackingConfig(settings);
            if (settings.zone) {
                window.electronAPI.saveCameraConfig({
                    zone: settings.zone,
                    handZone: settings.handZone,
                    gestureZone: settings.gestureZone,
                    gestures: settings.gestures,
                    overlay: settings.overlay,
                    gestureVisibility: settings.gestureVisibility,
                    alerts: settings.alerts
                });
            }
        }
    }, [settings]);

    const handleSetDepthNear = useCallback((value: number) => {
        setCalibration(prev => ({ ...prev, depthNear: value }));
        window.electronAPI?.saveCameraConfig({ depthNear: value });
    }, []);

    const handleSetDepthFar = useCallback((value: number) => {
        setCalibration(prev => ({ ...prev, depthFar: value }));
        window.electronAPI?.saveCameraConfig({ depthFar: value });
    }, []);

    const handleSetShowMarkers = useCallback((value: boolean) => {
        setShowMarkers(value);
        window.electronAPI?.saveCameraConfig({ showMarkers: value });
    }, []);

    const handleSetShowGrayscale = useCallback((value: boolean) => {
        setShowGrayscale(value);
        window.electronAPI?.saveCameraConfig({ showGrayscale: value });
    }, []);

    const value: ConfigContextValue = {
        settings,
        updateSettings,
        updateZoneConfig,
        handZone: settings.handZone || { ...HAND_ZONE_DEFAULTS },
        updateHandZone,
        gestureZone: settings.gestureZone || { ...GESTURE_ZONE_DEFAULTS },
        updateGestureZone,
        isHandEditMode,
        setHandEditMode,
        isGestureZoneEditMode,
        setGestureZoneEditMode,
        isZoneEditMode,
        setZoneEditMode,
        calibration,
        setCalibration,
        setDepthNear: handleSetDepthNear,
        setDepthFar: handleSetDepthFar,
        showRawData,
        setShowRawData,
        showNeutralDot,
        setShowNeutralDot,
        showGestureDebug,
        setShowGestureDebug,
        showMarkers,
        setShowMarkers: handleSetShowMarkers,
        showGrayscale,
        setShowGrayscale: handleSetShowGrayscale,
        duoFaceOffset: settings.duoFaceOffset ?? 10.0, // Provide duoFaceOffset
        isLoading,
        masterConfig
    };

    return (
        <ConfigContext.Provider value={value}>
            {children}
        </ConfigContext.Provider>
    );
}

export function useConfig(): ConfigContextValue {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
}