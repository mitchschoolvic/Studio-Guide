import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceVector, HandZoneConfig } from '../types/schemas';

interface InteractionResult {
    isInside: boolean;
    progress: number;
    isTriggered: boolean;
}

export function useNeutralZoneInteraction(
    dataRef: React.MutableRefObject<(FaceVector | null)[]>,
    config: HandZoneConfig
) {
    const [result, setResult] = useState<InteractionResult>({
        isInside: false,
        progress: 0,
        isTriggered: false
    });

    const rafId = useRef<number | null>(null);
    const enterTimeRef = useRef<number | null>(null);
    const isTriggeredRef = useRef(false);

    // Live config ref
    const configRef = useRef(config);
    useEffect(() => { configRef.current = config; }, [config]);

    const loop = useCallback(() => {
        const faces = dataRef.current;
        const currentConfig = configRef.current;
        const { box: zoneBox } = currentConfig;

        if (!currentConfig.enabled) {
            setResult({ isInside: false, progress: 0, isTriggered: false });
            return;
        }

        let isInside = false;

        if (faces && faces.length > 0 && faces[0]) {
            const face = faces[0];

            // Neutral Logic
            // face.neutral_x / y are normalized (0-1)
            // Mirrors X because webcam is mirrored
            const x = (1.0 - face.neutral_x);
            const y = face.neutral_y;

            // Check AABB
            if (
                x >= zoneBox.x &&
                x <= zoneBox.x + zoneBox.width &&
                y >= zoneBox.y &&
                y <= zoneBox.y + zoneBox.height
            ) {
                isInside = true;
            }
        }

        // Timer Logic
        const now = performance.now();
        let progress = 0;

        if (isInside) {
            if (enterTimeRef.current === null) {
                enterTimeRef.current = now;
            }

            const elapsed = now - enterTimeRef.current;
            progress = Math.min(1.0, elapsed / currentConfig.holdDurationMs);

            if (progress >= 1.0 && !isTriggeredRef.current) {
                isTriggeredRef.current = true;
                // External Event Trigger
                // We dispatch a custom window event for decoupled listeners
                const event = new CustomEvent('neutral-zone-triggered', { detail: { timestamp: now } });
                window.dispatchEvent(event);
                console.log('[NeutralZone] Triggered!');
            }
        } else {
            enterTimeRef.current = null;
            isTriggeredRef.current = false;
            progress = 0;
        }

        setResult(prev => {
            if (
                prev.isInside === isInside &&
                Math.abs(prev.progress - progress) < 0.01 &&
                prev.isTriggered === isTriggeredRef.current
            ) {
                return prev;
            }
            return { isInside, progress, isTriggered: isTriggeredRef.current };
        });

        rafId.current = requestAnimationFrame(loop);
    }, [dataRef]); // Dependency on dataRef (which is stable)

    useEffect(() => {
        rafId.current = requestAnimationFrame(loop);
        return () => {
            if (rafId.current) cancelAnimationFrame(rafId.current);
        };
    }, [loop]);

    return result;
}
