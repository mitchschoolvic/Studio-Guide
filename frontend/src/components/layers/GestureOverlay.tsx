import React, { useRef, useEffect } from 'react';
import { useTracking } from '../../contexts/TrackingContext';
import { useConfig } from '../../contexts/ConfigContext';
import { GestureType } from '../../types/schemas';

export function GestureOverlay() {
    const { liveHandData } = useTracking();
    const { showGestureDebug } = useConfig();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!showGestureDebug) {
            // clear canvas if hidden
            const ctx = canvasRef.current?.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current?.width || 0, canvasRef.current?.height || 0);
            return;
        }

        let animId: number;

        const render = () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx) return;

            // Clear frame
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const hands = liveHandData.current;
            if (!hands || hands.length === 0) {
                animId = requestAnimationFrame(render);
                return;
            }

            // Draw settings
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            hands.forEach(hand => {
                const { box, gesture, gestureScore, isLeft } = hand;

                // Convert normalized coords to pixels
                const x = box.x * canvas.width;
                const y = box.y * canvas.height;
                const w = box.width * canvas.width;
                // const h = box.height * canvas.height;

                // Draw Label only if gesture is detected (not None)
                if (gesture !== GestureType.None) {
                    const text = `${gesture} (${(gestureScore * 100).toFixed(0)}%)`;
                    const centerX = x + (w / 2);
                    const topY = y - 10;

                    // Background pill
                    const textMetrics = ctx.measureText(text);
                    const padding = 6;
                    const bgW = textMetrics.width + (padding * 2);
                    const bgH = 24;

                    ctx.fillStyle = isLeft ? 'rgba(255, 0, 136, 0.8)' : 'rgba(0, 255, 136, 0.8)';
                    ctx.beginPath();
                    ctx.roundRect(centerX - (bgW / 2), topY - bgH, bgW, bgH, 6);
                    ctx.fill();

                    // Text
                    ctx.fillStyle = '#000000';
                    ctx.fillText(text, centerX, topY - 4);
                }
            });

            animId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animId);
    }, [showGestureDebug, liveHandData]);

    return (
        <canvas
            ref={canvasRef}
            width={1920} // Match internal render resolution
            height={1080}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 20 // Above mesh, below UI controls
            }}
        />
    );
}
