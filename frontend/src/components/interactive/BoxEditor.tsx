import React, { useRef, useState, useEffect, useCallback } from 'react';

interface Box { x: number; y: number; width: number; height: number; }

interface Props {
    box: Box;
    onUpdate: (box: Box) => void;
    containerRef: React.RefObject<HTMLElement>;
}

export function BoxEditor({ box, onUpdate, containerRef }: Props) {
    const [dragMode, setDragMode] = useState<'move' | 'resize' | null>(null);
    const startPos = useRef({ x: 0, y: 0 });
    const startBox = useRef(box);

    const handleMouseDown = (e: React.MouseEvent, mode: 'move' | 'resize') => {
        e.stopPropagation();
        setDragMode(mode);
        startPos.current = { x: e.clientX, y: e.clientY };
        startBox.current = box;
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragMode || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        // Delta in Percentage (Normalized)
        const dx = (e.clientX - startPos.current.x) / rect.width;
        const dy = (e.clientY - startPos.current.y) / rect.height;

        const b = startBox.current;
        let newBox = { ...b };

        if (dragMode === 'move') {
            newBox.x = Math.max(0, Math.min(1 - b.width, b.x + dx));
            newBox.y = Math.max(0, Math.min(1 - b.height, b.y + dy));
        } else if (dragMode === 'resize') {
            newBox.width = Math.max(0.05, Math.min(1 - b.x, b.width + dx));
            newBox.height = Math.max(0.05, Math.min(1 - b.y, b.height + dy));
        }

        onUpdate(newBox);
    }, [dragMode, containerRef, onUpdate]);

    const handleMouseUp = useCallback(() => setDragMode(null), []);

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

    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${box.x * 100}%`, top: `${box.y * 100}%`,
        width: `${box.width * 100}%`, height: `${box.height * 100}%`,
        border: '2px dashed #4facfe',
        cursor: 'move',
        pointerEvents: 'auto'
    };

    return (
        <div style={style} onMouseDown={(e) => handleMouseDown(e, 'move')}>
            {/* Resize Handle (Bottom Right) */}
            <div
                style={{
                    position: 'absolute', bottom: -10, right: -10,
                    width: 24, height: 24, background: '#fff',
                    border: '2px solid #4facfe', borderRadius: '50%',
                    cursor: 'nwse-resize', zIndex: 10
                }}
                onMouseDown={(e) => handleMouseDown(e, 'resize')}
            />
        </div>
    );
}
