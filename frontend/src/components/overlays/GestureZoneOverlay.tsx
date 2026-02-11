import { useConfig } from '../../contexts/ConfigContext';
import { useTracking } from '../../contexts/TrackingContext';
import { BoxEditor } from '../interactive/BoxEditor';
import { useRef, useState, useEffect } from 'react';

interface Props {
    isHovered: boolean;
}

/**
 * Gesture Zone Overlay
 * Displays and allows editing of the gesture detection zone.
 * Gestures are only recognized when detected within this zone.
 * Zone highlights GREEN when a trigger is active (single source of truth from worker).
 */
export function GestureZoneOverlay({ isHovered }: Props) {
    const {
        gestureZone,
        updateGestureZone,
        isGestureZoneEditMode,
        setGestureZoneEditMode
    } = useConfig();
    const { liveTriggers } = useTracking();
    const containerRef = useRef<HTMLDivElement>(null);
    const [hasTrigger, setHasTrigger] = useState(false);

    // Poll liveTriggers (a ref) to determine if any trigger is active
    // This is the SINGLE SOURCE OF TRUTH - same data as trigger status panel
    useEffect(() => {
        if (!gestureZone?.enabled) return;

        const interval = setInterval(() => {
            const triggers = liveTriggers.current;
            setHasTrigger(triggers && triggers.length > 0);
        }, 50); // 20Hz update rate

        return () => clearInterval(interval);
    }, [gestureZone?.enabled, liveTriggers]);

    // Edit Button Style - positioned to not conflict with hand zone button
    const btnStyle: React.CSSProperties = {
        position: 'absolute',
        top: 10,
        left: 100, // Offset from hand zone button
        zIndex: 110,
        background: isGestureZoneEditMode ? '#ff00de' : 'rgba(0,0,0,0.5)',
        border: 'none',
        borderRadius: 4,
        color: 'white',
        padding: '5px 10px',
        cursor: 'pointer',
        pointerEvents: 'auto',
        opacity: (isHovered || isGestureZoneEditMode) ? 1 : 0,
        transition: 'opacity 0.3s ease',
        fontSize: '0.85em'
    };

    // Zone display style - changes to GREEN when a trigger is active
    const zoneColor = hasTrigger ? '#00ff88' : '#ff00de';
    const zoneDisplayStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${gestureZone.box.x * 100}%`,
        top: `${gestureZone.box.y * 100}%`,
        width: `${gestureZone.box.width * 100}%`,
        height: `${gestureZone.box.height * 100}%`,
        border: `3px solid ${zoneColor}`,
        borderRadius: 8,
        pointerEvents: 'none',
        opacity: gestureZone.showOverlay ? (hasTrigger ? 0.9 : 0.6) : 0,
        transition: 'border-color 0.15s ease, opacity 0.15s ease',
        boxShadow: hasTrigger ? `0 0 20px ${zoneColor}` : 'none'
    };

    if (!gestureZone?.enabled) return null;

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 45 // Above hand zone (40) but below other controls
            }}
        >
            {/* Edit Toggle Button */}
            <button
                style={btnStyle}
                onClick={() => setGestureZoneEditMode(!isGestureZoneEditMode)}
            >
                {isGestureZoneEditMode ? 'Done' : 'Gesture Zone'}
            </button>

            {/* Zone Display (non-edit mode) */}
            {!isGestureZoneEditMode && gestureZone.showOverlay && (
                <div style={zoneDisplayStyle} />
            )}

            {/* Box Editor (edit mode) */}
            {isGestureZoneEditMode && (
                <BoxEditor
                    box={gestureZone.box}
                    onUpdate={(b) => updateGestureZone({ box: b })}
                    containerRef={containerRef as React.RefObject<HTMLElement>}
                />
            )}
        </div>
    );
}
