
import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { FaceVector } from '../../types/schemas';

export function NeutralDotOverlay({ dataRef }: { dataRef: MutableRefObject<(FaceVector | null)[]> }) {
    // We can use a simple state to drive the dot position for smooth REACT updates, 
    // OR use a ref + direct DOM manipulation for performance (60fps).
    // Given React 18 concurrent features, state might be fine, but direct DOM is safer for high freq.

    const dotRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>();

    useEffect(() => {
        const update = () => {
            const faces = dataRef.current;
            if (faces && faces.length > 0 && faces[0]) {
                const face = faces[0];
                if (dotRef.current) {
                    // face.neutral_x / y are now NORMALIZED (0.0 - 1.0)
                    // We need to mirror X because the video is mirrored.
                    // If X=0.1 (left) in camera, it should be 0.9 (right) on mirrored screen?
                    // The WebcamLayer has `transform: scaleX(-1)`.
                    // If we place this overlay INSIDE a container that IS NOT scaled, we need to handle mirroring manually.
                    // FaceTrackerCard structure:
                    // <WebcamLayer ... scaleX(-1) />
                    // <NeutralDotOverlay /> (Sibling)
                    // So NeutralDotOverlay is in a normal container.

                    // IF we want to match the video, we should mirror the X coordinate.
                    // x' = 1.0 - x

                    const x = (1.0 - face.neutral_x) * 100;
                    const y = face.neutral_y * 100;

                    dotRef.current.style.display = 'block';
                    dotRef.current.style.left = `${x}%`;
                    dotRef.current.style.top = `${y}%`;
                }
            } else {
                if (dotRef.current) {
                    dotRef.current.style.display = 'none';
                }
            }
            requestRef.current = requestAnimationFrame(update);
        };

        requestRef.current = requestAnimationFrame(update);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [dataRef]);

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 30,
                overflow: 'hidden' // Prevent dot from spilling out
            }}
        >
            <div
                ref={dotRef}
                style={{
                    position: 'absolute',
                    width: '10px',
                    height: '10px',
                    backgroundColor: '#00ff88',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)', // Center the dot on the coordinate
                    display: 'none',
                    boxShadow: '0 0 8px rgba(0, 255, 136, 0.6)'
                }}
            />
        </div>
    );
}
