// File: frontend/src/components/layers/DraggableOverlay.tsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useConfig } from '../../contexts/ConfigContext';
import { GlassesSvg } from '../GlassesSvg';


import { NEUTRAL_ZONE_COLOR, GLASSES_COLOR_DEFAULT } from '../../shared/constants';

interface Props {
    isInside: boolean;
}

export function DraggableOverlay({ isInside }: Props) {
    const { settings, updateSettings } = useConfig();
    const overlayConfig = settings.overlay;

    // Use shared state for color (SRP/DRY)
    const glassesColor = isInside ? NEUTRAL_ZONE_COLOR : GLASSES_COLOR_DEFAULT;

    const containerRef = useRef<HTMLDivElement>(null);
    const [dragMode, setDragMode] = useState<'move' | 'resize' | null>(null);

    // Refs to track drag start and current state without triggering re-renders during drag
    const startPos = useRef({ x: 0, y: 0 });
    const startState = useRef({ x: 0.5, y: 0.5, scale: 1.0 });
    const currentStateRef = useRef({ x: 0.5, y: 0.5, scale: 1.0 });

    // Local state for smooth 60fps rendering
    const [localState, setLocalState] = useState({ x: 0.5, y: 0.5, scale: 1.0 });

    // Sync local state with global settings when NOT dragging
    useEffect(() => {
        if (!dragMode && overlayConfig) {
            const newState = {
                x: overlayConfig.x ?? 0.5,
                y: overlayConfig.y ?? 0.5,
                scale: overlayConfig.scale ?? 1.0
            };
            setLocalState(newState);
            currentStateRef.current = newState;
        }
    }, [overlayConfig, dragMode]);

    const handleMouseDown = (e: React.MouseEvent, mode: 'move' | 'resize') => {
        e.stopPropagation();
        e.preventDefault();
        setDragMode(mode);
        startPos.current = { x: e.clientX, y: e.clientY };
        // Capture the state at the moment dragging starts
        startState.current = { ...currentStateRef.current };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragMode || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();

        // Calculate deltas based on screen pixels vs container size
        const dx = (e.clientX - startPos.current.x) / rect.width;
        const dy = (e.clientY - startPos.current.y) / rect.height;

        const s = startState.current;
        let newState = { ...s };

        if (dragMode === 'move') {
            newState.x = Math.max(0, Math.min(1, s.x + dx));
            newState.y = Math.max(0, Math.min(1, s.y + dy));
        } else if (dragMode === 'resize') {
            // Dragging right increases scale
            const scaleDelta = (e.clientX - startPos.current.x) * 0.005;
            newState.scale = Math.max(0.1, Math.min(5.0, s.scale + scaleDelta));
        }

        // Update visual state immediately
        setLocalState(newState);
        currentStateRef.current = newState;
    }, [dragMode]);

    const handleMouseUp = useCallback(() => {
        if (dragMode) {
            // SAVE TO CONFIG.JSON: Update global settings once drag finishes
            const final = currentStateRef.current;
            updateSettings({
                overlay: {
                    enabled: true,
                    x: final.x,
                    y: final.y,
                    scale: final.scale
                }
            });
        }
        setDragMode(null);
    }, [dragMode, updateSettings]);

    // Attach global listeners only when dragging
    useEffect(() => {
        if (dragMode) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragMode, handleMouseMove, handleMouseUp]);

    if (!overlayConfig?.enabled) return null;

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                pointerEvents: 'none', zIndex: 900
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: `${localState.x * 100}%`,
                    top: `${localState.y * 100}%`,
                    transform: `translate(-50%, -50%) scale(${localState.scale})`,
                    // Base width relative to container (Responsive)
                    width: '25%',
                    cursor: dragMode === 'move' ? 'grabbing' : 'grab',
                    pointerEvents: 'auto',
                    userSelect: 'none',
                    // Transparent border/bg ensures the div has a hit area even if image is "none"
                    border: dragMode ? '1px dashed #4facfe' : '1px solid transparent',
                    padding: '10px'
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
                title="Drag to move, use white handle to resize"
            >
                {/* The SVG Image */}
                <GlassesSvg
                    color={glassesColor}
                    style={{
                        display: 'block',
                        width: '100%', // Responsive width (Fill container)
                        pointerEvents: 'none' // Clicks pass through to the parent div
                    }}
                />

                {/* Resize Handle */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: -15,
                        right: -15,
                        width: 30,
                        height: 30,
                        background: '#fff',
                        border: '2px solid #4facfe',
                        borderRadius: '50%',
                        cursor: 'nwse-resize',
                        zIndex: 10,
                        pointerEvents: 'auto',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, 'resize')}
                />
            </div>
        </div>
    );
}