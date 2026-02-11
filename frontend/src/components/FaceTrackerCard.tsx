import { MutableRefObject, useState } from 'react';
import { FaceVector } from '../types/schemas';
import { WebcamLayer } from './WebcamLayer';
import { useTracking } from '../contexts/TrackingContext';
import { FaceMeshLayer } from './layers/FaceMeshLayer';
import { NeutralInteractionLayer } from './layers/NeutralInteractionLayer';
import { GestureOverlay } from './layers/GestureOverlay';
import { NeutralDotOverlay } from './layers/NeutralDotOverlay';
import { DraggableOverlay } from './layers/DraggableOverlay';
import { GestureZoneOverlay } from './overlays/GestureZoneOverlay';
import safeZoneOverlay from '../assets/SafeZone-Glasses.png';
import safeZoneOverlayTwoFaces from '../assets/SafeZone-Glasses-two-faces.png';
import markersOverlay from '../assets/markers.png';
import { useConfig } from '../contexts/ConfigContext';
import { useLayoutEngine } from '../hooks/useLayoutEngine';

import { NEUTRAL_ZONE_COLOR } from '../shared/constants';
import { useNeutralZoneInteraction } from '../hooks/useNeutralZoneInteraction';

interface Props {
    dataRef: MutableRefObject<(FaceVector | null)[]>;
}

export function FaceTrackerCard({ dataRef }: Props) {
    // 1. Get shared refs from Context
    const { liveFaceData } = useTracking();
    const { showNeutralDot, showMarkers, handZone, showGrayscale } = useConfig();
    // const [showOverlay, setShowOverlay] = useState(false); // REMOVED local state

    // Single Logic Source for Neutral Zone (SOLID/DRY)
    const { isInside } = useNeutralZoneInteraction(liveFaceData, handZone);

    // Layout Engine
    // liveFaceData is a Ref, useLayoutEngine handles the reactivity
    const layoutState = useLayoutEngine(dataRef);
    const isDuo = layoutState === 'DUO';
    const isWarning = layoutState === 'CROWD_WARNING';

    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="face-tracker-card"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                background: '#222',
                // Trigger Visual Feedback (Green Outline)
                border: isInside ? `4px solid ${NEUTRAL_ZONE_COLOR}` : '4px solid transparent',
                borderRadius: '16px', // Curved corners
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease',
                overflow: 'hidden' // Ensure content respects border radius
            }}
        >

            {/* 2. Base Webcam Layer */}
            <WebcamLayer
                style={showGrayscale ? {
                    filter: 'grayscale(100%) contrast(100%)',
                    transform: 'scaleX(-1) translateZ(0)', // Force GPU layer
                    willChange: 'filter'
                } : undefined}
            />

            {/* SafeZone Overlay - SOLO */}
            {showGrayscale && (
                <img
                    src={safeZoneOverlay}
                    alt="SafeZone Overlay Solo"
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        zIndex: 10,
                        opacity: (!isDuo && !isWarning) ? 0.8 : 0, // Hide if Duo OR Warning
                        transition: 'opacity 0.5s ease-in-out'
                    }}
                />
            )}

            {/* SafeZone Overlay - DUO */}
            {showGrayscale && (
                <img
                    src={safeZoneOverlayTwoFaces}
                    alt="SafeZone Overlay Duo"
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        zIndex: 10,
                        opacity: (isDuo && !isWarning) ? 0.8 : 0, // Hide if not Duo OR Warning (Warning takes precedence)
                        transition: 'opacity 0.5s ease-in-out'
                    }}
                />
            )}

            {/* Markers Overlay */}
            {showMarkers && (
                <img
                    src={markersOverlay}
                    alt="Markers Overlay"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        zIndex: 11, // Higher than SafeZone
                        opacity: 1.0
                    }}
                />
            )}


            {/* 3. Neutral Interaction Layer (Replaces Hand Interaction) */}
            <NeutralInteractionLayer isHovered={isHovered} />

            {/* 3.5 Gesture Zone Overlay (Edit + Display) */}
            <GestureZoneOverlay isHovered={isHovered} />

            {/* 4. Face Mesh Layer (Isolated from Hand State) */}
            <FaceMeshLayer dataRef={dataRef} />


            {/* 5. Gesture Debug Overlay */}
            <GestureOverlay />

            {/* Draggable Glasses Overlay */}
            <DraggableOverlay isInside={isInside} />

            {/* 6. Neutral Dot Overlay */}
            {showNeutralDot && (
                <NeutralDotOverlay dataRef={dataRef} />
            )}

        </div>
    );
}