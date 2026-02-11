import { createContext, useContext, ReactNode, useRef, useEffect, useMemo, useState } from 'react';
import { FaceVector, TrackingPayload, TrackingConfig, DetectedHand } from '../types/schemas';
import { useConfig } from './ConfigContext';
import { useHardware } from './HardwareContext';
import { useCameraStream } from '../hooks/useCameraStream';
import { useFaceTracking } from '../hooks/useFaceTracking';

declare global {
    interface Window {
        electronAPI: {
            broadcastTrackingData: (data: TrackingPayload) => void;
            onTrackingUpdate: (callback: (data: TrackingPayload) => void) => () => void;
            getDisplays: () => Promise<any[]>;
            toggleSecondaryWindow: (id: number) => Promise<boolean>;
            saveCameraConfig: (config: any) => Promise<void>;
            getCameraConfig: () => Promise<any>;
            openConfigLocation: () => Promise<void>;
            openLogLocation: () => Promise<void>;
            updateTrackingConfig: (config: any) => Promise<void>;
            getMasterConfig: () => Promise<any>;
            sendEmailAlert: (endpointUrl: string, htmlBody: string, subject?: string) => Promise<{ success: boolean; error?: string }>;
            log: {
                error: (message: string, ...data: any[]) => void;
                warn: (message: string, ...data: any[]) => void;
                info: (message: string, ...data: any[]) => void;
                debug: (message: string, ...data: any[]) => void;
            };
        };
    }
}

interface TrackingContextValue {
    liveFaceData: React.MutableRefObject<(FaceVector | null)[]>;
    liveHandData: React.MutableRefObject<DetectedHand[]>;
    liveTriggers: React.MutableRefObject<string[]>;
    livePendingTriggers: React.MutableRefObject<{ id: string; progress: number }[]>;
    faceCountRef: React.MutableRefObject<number>;
    status: string;
    isCompanionConnected: boolean; // NEW
    lastVariableMessage: { type: 'recording' | 'playback' | 'generic', value: any, timestamp: number } | null;
    videoRef: React.RefObject<HTMLVideoElement>;
    stream: MediaStream | null;
}

const TrackingContext = createContext<TrackingContextValue | null>(null);

export function TrackingProvider({ children }: { children: ReactNode }) {
    const params = new URLSearchParams(window.location.search);
    const isAdmin = params.get('mode') !== 'secondary';
    const { settings } = useConfig();
    const { selectedCameraId, cameraReconnectTrigger, notifyCameraDisconnected } = useHardware();

    const videoRef = useRef<HTMLVideoElement>(null);
    const { stream, error: camError } = useCameraStream(
        selectedCameraId,
        1920,
        1080,
        cameraReconnectTrigger,
        { onDisconnect: notifyCameraDisconnected }
    );

    // NEW: State for Companion Connection
    const [isCompanionConnected, setIsCompanionConnected] = useState(false);

    // FIX: Memoize this object to prevent infinite reconfiguration loops
    const trackingConfig = useMemo<TrackingConfig>(() => ({
        cameraDeviceId: selectedCameraId,
        width: 1920,
        height: 1080,
        fov: 50.0,
        maxFaces: 4,
        showMesh: !!settings.showMesh,
        headWidthMm: 160.0,
        depthNearMm: 500,
        depthFarMm: 5000,
        eyeOffsetPx: settings.eyeOffsetPx || 0,
        mapScaleX: 1.0,
        zone: settings.zone || { enabled: true, minDepthMm: 300, maxDepthMm: 2500, widthPercent: 0.8 },
        handZone: settings.handZone, // Pass handZone config to worker
        gestureZone: settings.gestureZone, // Pass gestureZone config to worker
        overlay: settings.overlay || { enabled: false, x: 0.5, y: 0.5, scale: 1.0 },
        gestures: settings.gestures || ({} as any), // Pass gestures config
        showNeutralDot: !!settings.showNeutralDot,
        showMarkers: !!settings.showMarkers,
        showGrayscale: !!settings.showGrayscale
    }), [
        selectedCameraId,
        settings.showMesh,
        settings.eyeOffsetPx,
        settings.zone,
        settings.handZone,
        settings.gestureZone,
        settings.overlay,
        settings.gestures,
        settings.showNeutralDot,
        settings.showMarkers,
        settings.showGrayscale
    ]);

    // Get the RAW ref directly from the hook. No need to copy it.
    const { status: trackStatus, liveDataRef, liveHandDataRef, liveTriggersRef, livePendingTriggersRef, trackingService } = useFaceTracking(
        videoRef as React.RefObject<HTMLVideoElement>,
        trackingConfig,
        isAdmin
    );

    const [lastVariableMessage, setLastVariableMessage] = useState<{ type: 'recording' | 'playback' | 'generic', value: any, timestamp: number } | null>(null);

    // Listen for Companion Status
    useEffect(() => {
        if (!trackingService) return;

        const handler = (connected: boolean) => {
            setIsCompanionConnected(connected);
        };

        const variableHandler = (data: { messageType: 'recording' | 'playback' | 'generic', value: any, timestamp: number }) => {
            setLastVariableMessage({ type: data.messageType, value: data.value, timestamp: data.timestamp });
        };

        trackingService.on('companion-status', handler);
        trackingService.on('variable-update', variableHandler);

        return () => {
            trackingService.off('companion-status', handler);
            trackingService.off('variable-update', variableHandler);
        };
    }, [trackingService]);

    // Timeout to clear message
    useEffect(() => {
        if (!lastVariableMessage) return;

        const timer = setTimeout(() => {
            setLastVariableMessage(null);
        }, 3000);

        return () => clearTimeout(timer);
    }, [lastVariableMessage]);

    // Face count can be computed on demand or stored in a ref if needed for UI stats
    const faceCountRef = useRef(0);

    // Efficiently update faceCount without re-rendering logic
    useEffect(() => {
        if (!isAdmin) return;
        // Optional: If you need a live counter for UI, update it here. 
        // We attach a small poller ONLY for the counter number, or trust the consumer to check the ref length.
        const interval = setInterval(() => {
            if (liveDataRef.current) {
                faceCountRef.current = liveDataRef.current.filter(f => f !== null).length;
            }
        }, 100); // 10Hz is plenty for a UI counter
        return () => clearInterval(interval);
    }, [isAdmin, liveDataRef]);

    // Secondary Window Logic
    useEffect(() => {
        if (!isAdmin && window.electronAPI) {
            const unsub = window.electronAPI.onTrackingUpdate((payload) => {
                liveDataRef.current = payload.faces;
                if (payload.hands) liveHandDataRef.current = payload.hands;
                if (payload.activeTriggers) liveTriggersRef.current = payload.activeTriggers;
                faceCountRef.current = payload.total_faces_detected;
            });
            return () => unsub();
        }
    }, [isAdmin, liveDataRef, liveHandDataRef, liveTriggersRef]);

    // MEMOIZE THE VALUE
    const value = useMemo<TrackingContextValue>(() => ({
        liveFaceData: liveDataRef, // Pass the ref directly!
        liveHandData: liveHandDataRef,
        liveTriggers: liveTriggersRef,
        livePendingTriggers: livePendingTriggersRef,
        faceCountRef,
        status: camError || trackStatus,
        isCompanionConnected, // Exposed
        lastVariableMessage,
        videoRef: videoRef as React.RefObject<HTMLVideoElement>,
        stream
    }), [liveDataRef, liveHandDataRef, liveTriggersRef, livePendingTriggersRef, camError, trackStatus, stream, isCompanionConnected, lastVariableMessage]);

    return (
        <TrackingContext.Provider value={value}>
            {children}
        </TrackingContext.Provider>
    );
}



export function useTracking() {
    const context = useContext(TrackingContext);
    if (!context) throw new Error("useTracking must be used within TrackingProvider");
    return context;
}