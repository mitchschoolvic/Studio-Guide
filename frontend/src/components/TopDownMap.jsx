import React, { useRef, useEffect } from 'react';

export function TopDownMap({ dataRef, depthNear, depthFar }) {
    // MediaPipe tracker is configured for max 2 faces
    const markers = [0, 1];

    return (
        <div className="top-down-card" style={{
            width: '100%', height: '100%',
            background: '#1a1a1a',
            borderRadius: '12px',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
            <div style={{
                padding: '12px',
                background: '#2a2a2a',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                borderBottom: '1px solid #333'
            }}>
                Top Down View
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#333" strokeWidth="0.5" />
                        </pattern>
                    </defs>
                    <rect width="100" height="100" fill="url(#grid)" />

                    {/* Camera */}
                    <circle cx="50" cy="95" r="2" fill="#888" />
                    <text x="50" y="99" fontSize="3" textAnchor="middle" fill="#888" style={{ fontFamily: 'sans-serif' }}>CAM</text>

                    {markers.map(i => (
                        <FaceMarker key={i} index={i} dataRef={dataRef} depthNear={depthNear} depthFar={depthFar} />
                    ))}
                </svg>
            </div>
        </div>
    );
}

function FaceMarker({ index, dataRef, depthNear, depthFar }) {
    const groupRef = useRef(null);

    useEffect(() => {
        let animId;
        const update = () => {
            if (groupRef.current && dataRef.current && dataRef.current[index]) {
                const face = dataRef.current[index];

                // 1. Get Pose Data (Real World mm)
                const tx = face.t_x || 0;
                let tz = face.t_z;
                if (tz === undefined) tz = Math.abs(face.z * 1000); // Fallback
                const yaw = face.yaw || 0;
                const yawRad = yaw * (Math.PI / 180);

                // 2. Apply Head Center Offset
                // Model origin is Nose. Head pivot/center is behind nose.
                // Assuming +Z is "Away", +X is "Right" (Subject).
                // Rotation helps interpret direction.
                // We want to shift "Backwards".
                // Offset vector (0, 0, 150) rotated by Yaw.
                // Simple trig:
                // NewX = OldX + sin(yaw) * Offset
                // NewZ = OldZ + cos(yaw) * Offset
                // (Signs might need flipping depending on coordinate system, trial/error or rigorous check)
                // Let's try: Offset = 150mm
                const OFFSET = 150;
                const cx = tx + Math.sin(yawRad) * OFFSET;
                const cz = tz + Math.cos(yawRad) * OFFSET;

                // 3. Map Z to Y (Depth)
                const NEAR = depthNear || 500;
                const FAR = depthFar || 5000;
                let distNorm = (cz - NEAR) / (FAR - NEAR);
                distNorm = Math.max(0, Math.min(1, distNorm));
                const yPct = 90 - (distNorm * 80);

                // 4. Map X to X (Projected Frustum)
                // We want Edge of Camera Frame -> Edge of Grid.
                // In Pinhole model with FOV matched to width: X/Z = u - 0.5
                // So u = (X / Z) + 0.5
                // where X is cx (Offset Head Center X) and Z is cz.

                let xNorm = 0.5;
                if (cz !== 0) {
                    xNorm = (cx / cz) + 0.5;
                }

                // Clamp 0..1 (Keep inside grid even if slightly outside frame)
                xNorm = Math.max(0, Math.min(1, xNorm));

                // Mirroring (Selfie View)
                let xPct = (1 - xNorm) * 100;

                // DEBUG: Show raw value on the marker
                const textElem = groupRef.current.querySelector('.debug-text');
                if (textElem) textElem.textContent = Math.round(cz);

                // Translate, then Rotate
                // Now we are positioning the GROUP at the Head Center.
                groupRef.current.setAttribute('transform', `translate(${xPct}, ${yPct}) rotate(${yaw})`);
                groupRef.current.style.display = 'block';

            } else if (groupRef.current) {
                groupRef.current.style.display = 'none';
            }
            animId = requestAnimationFrame(update);
        };
        animId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(animId);
    }, [dataRef, index, depthNear, depthFar]);

    return (
        <g ref={groupRef} style={{ display: 'none', transition: 'transform 0.05s linear' }}>
            {/* Square SVG */}
            <rect x="-4" y="-4" width="8" height="8" fill={index === 0 ? "#00ff88" : "#00ccff"} rx="1" stroke="#fff" strokeWidth="0.5" />
            {/* Direction Indicator */}
            <line x1="0" y1="0" x2="0" y2="-6" stroke="black" strokeWidth="1" />
            <text className="debug-text" x="0" y="8" fontSize="3" textAnchor="middle" fill="white">0</text>
        </g>
    );
}
