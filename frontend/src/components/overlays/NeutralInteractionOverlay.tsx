import { useConfig } from '../../contexts/ConfigContext';
import { BoxEditor } from '../interactive/BoxEditor';
import { useRef } from 'react';

interface Props {
    isHovered: boolean;
}

export function NeutralInteractionOverlay({ isHovered }: Props) {
    const { handZone, updateHandZone, isHandEditMode, setHandEditMode } = useConfig();
    const containerRef = useRef<HTMLDivElement>(null);

    // Edit Button Style
    const btnStyle: React.CSSProperties = {
        position: 'absolute', top: 10, left: 10, zIndex: 110, // Higher than before
        background: isHandEditMode ? '#4facfe' : 'rgba(0,0,0,0.5)',
        border: 'none', borderRadius: 4, color: 'white', padding: '5px 10px',
        cursor: 'pointer',
        pointerEvents: 'auto',
        opacity: (isHovered || isHandEditMode) ? 1 : 0,
        transition: 'opacity 0.3s ease'
    };

    if (!handZone?.enabled) return null;

    return (
        <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 40 }}>

            {/* Edit Toggle */}
            <button style={btnStyle} onClick={() => setHandEditMode(!isHandEditMode)}>
                {isHandEditMode ? 'Done' : 'Edit Zone'}
            </button>

            {/* Editor OR Live View */}
            {isHandEditMode && (
                <BoxEditor
                    box={handZone.box}
                    onUpdate={(b) => updateHandZone({ box: b })}
                    containerRef={containerRef as any}
                />
            )}
        </div>
    );
}
