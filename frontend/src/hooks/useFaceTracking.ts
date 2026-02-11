import { useState, useEffect, useRef } from 'react';
import { TrackingConfig, FaceVector, TrackingPayload, DetectedHand } from '../types/schemas';
import { TrackingService } from '../services/TrackingService';

export function useFaceTracking(
    videoRef: React.RefObject<HTMLVideoElement>,
    config: TrackingConfig,
    isEnabled: boolean = true
) {
    const [status, setStatus] = useState<string>("Initializing...");
    const liveDataRef = useRef<(FaceVector | null)[]>([]);
    const liveHandDataRef = useRef<DetectedHand[]>([]);
    const liveTriggersRef = useRef<string[]>([]);
    const livePendingTriggersRef = useRef<{ id: string; progress: number }[]>([]);
    const serviceRef = useRef<TrackingService | null>(null);

    // Initialize Service
    useEffect(() => {
        if (!isEnabled) {
            setStatus("Disabled");
            return;
        }

        // Guard to prevent logging errors from stale service instances
        // (e.g., when React Strict Mode double-mounts components)
        let isAlive = true;

        const service = new TrackingService(config);
        serviceRef.current = service;

        setStatus("Loading Models...");

        service.initialize()
            .then(() => {
                if (!isAlive) return; // Component unmounted, ignore
                setStatus("Ready");

                // Subscribe to updates
                service.on('tracking-update', (payload: TrackingPayload) => {
                    // Update Ref for high-frequency access without re-renders
                    liveDataRef.current = payload.faces;
                    if (payload.hands) liveHandDataRef.current = payload.hands;
                    if (payload.activeTriggers) liveTriggersRef.current = payload.activeTriggers;
                    if (payload.pendingTriggers) livePendingTriggersRef.current = payload.pendingTriggers;
                });

                // Auto-start if video is ready
                if (videoRef.current) {
                    service.start(videoRef.current);
                }
            })
            .catch(err => {
                if (!isAlive) return; // Stale instance, don't log or update state
                console.error("Tracking Init Error", err);
                setStatus("Error: " + err.message);
            });

        return () => {
            isAlive = false;
            service.dispose();
            serviceRef.current = null;
        };
    }, [isEnabled]); // Re-init if enabled status changes

    // Propagate Config Changes to Live Service
    useEffect(() => {
        if (serviceRef.current && isEnabled) {
            serviceRef.current.updateConfig(config);
        }
    }, [config, isEnabled]);

    // ... (omitted)

    return {
        status,
        liveDataRef,
        liveHandDataRef,
        liveTriggersRef,
        livePendingTriggersRef,
        trackingService: serviceRef.current
    };
}