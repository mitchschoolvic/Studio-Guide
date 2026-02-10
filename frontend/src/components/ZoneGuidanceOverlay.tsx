import React from 'react';
import { FaceVector, TrackingConfig } from '../types/schemas';
// import { CONFIG } from '../config'; // Removed
// Import the shared colors (or re-define if you prefer not to export from component files)
const FACE_COLORS = ['#00ff88', '#00ccff', '#ff0088', '#ffcc00'];

interface Props {
    data: (FaceVector | null)[];
    zoneConfig: TrackingConfig['zone'];
    cameraWidth?: number;
}

type GuidanceType = 'ok' | 'step-closer' | 'step-back' | 'step-left' | 'step-right';

function getGuidanceState(face: FaceVector, zone: TrackingConfig['zone'], cameraWidth: number = 1280): GuidanceType {
    if (!zone || !zone.enabled) return 'ok';

    const depthMm = Math.abs(face.z * 1000);
    const rawX = face.neutral_x;

    // Normalize X if it is in pixels
    const xNorm = rawX > 1.0 ? rawX / cameraWidth : rawX;

    // 1. Depth Checks (Priority)
    if (depthMm > zone.maxDepthMm) return 'step-closer';
    if (depthMm < zone.minDepthMm) return 'step-back';

    // 2. Horizontal Checks
    const margin = (1.0 - zone.widthPercent) / 2;
    if (xNorm < margin) return 'step-left';
    if (xNorm > (1.0 - margin)) return 'step-right';

    return 'ok';
}

export function ZoneGuidanceOverlay({ data, zoneConfig, cameraWidth = 1280 }: Props) {
    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            pointerEvents: 'none', overflow: 'hidden'
        }}>
            {data.map((face, i) => {
                if (!face) return null;
                const state = getGuidanceState(face, zoneConfig, cameraWidth);
                if (state === 'ok') return null;

                // FIX: Use cyclic coloring
                return (
                    <GuidanceLabel
                        key={i}
                        type={state}
                        color={FACE_COLORS[i % FACE_COLORS.length]}
                    />
                );
            })}
        </div>
    );
}

function GuidanceLabel({ type, color }: { type: GuidanceType, color: string }) {
    let text = "";
    const style: React.CSSProperties = {
        position: 'absolute',
        background: '#fff',
        color: '#000',
        padding: '8px 16px',
        borderRadius: '8px',
        fontWeight: 'bold',
        fontSize: '14px',
        boxShadow: `0 0 10px ${color}`,
        border: `2px solid ${color}`,
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        whiteSpace: 'nowrap'
    };

    const arrowSize = 8;
    const arrowStyle: React.CSSProperties = {
        width: 0, height: 0, borderStyle: 'solid', position: 'absolute'
    };

    switch (type) {
        case 'step-closer':
            text = "Step Closer";
            style.top = '20px';
            style.left = '50%';
            style.transform = 'translateX(-50%)';
            arrowStyle.borderWidth = `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`;
            arrowStyle.borderColor = `${color} transparent transparent transparent`;
            arrowStyle.bottom = -arrowSize;
            arrowStyle.left = '50%';
            arrowStyle.transform = 'translateX(-50%)';
            break;

        case 'step-back':
            text = "Step Back";
            style.bottom = '20px';
            style.left = '50%';
            style.transform = 'translateX(-50%)';
            arrowStyle.borderWidth = `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`;
            arrowStyle.borderColor = `transparent transparent ${color} transparent`;
            arrowStyle.top = -arrowSize;
            arrowStyle.left = '50%';
            arrowStyle.transform = 'translateX(-50%)';
            break;

        case 'step-left':
            text = "Step Left";
            style.right = '20px';
            style.top = '50%';
            style.transform = 'translateY(-50%)';
            // Swapped to point RIGHT (from step-right style)
            arrowStyle.borderWidth = `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`;
            arrowStyle.borderColor = `transparent transparent transparent ${color}`;
            arrowStyle.right = -arrowSize;
            arrowStyle.left = 'auto'; // Clear potential conflict if any defaults existed
            break;

        case 'step-right':
            text = "Step Right";
            style.left = '20px';
            style.top = '50%';
            style.transform = 'translateY(-50%)';
            // Swapped to point LEFT (from step-left style)
            arrowStyle.borderWidth = `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`;
            arrowStyle.borderColor = `transparent ${color} transparent transparent`;
            arrowStyle.left = -arrowSize;
            arrowStyle.right = 'auto';
            break;
    }

    return (
        <div style={style}>
            {text}
            <div style={arrowStyle} />
        </div>
    );
}

export { getGuidanceState };