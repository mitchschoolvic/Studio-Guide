import { useRef, useState, useEffect, MutableRefObject, useCallback } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { FaceVector, TrackingConfig } from '../types/schemas';
import { useConfig } from '../contexts/ConfigContext';
import { useLayoutEngine } from '../hooks/useLayoutEngine';
import { ZoneGuidanceOverlay, getGuidanceState } from './ZoneGuidanceOverlay';
import headImg from '../assets/head.png';
import headOutlineImg from '../assets/head outline.png';
import headOutlineGreenImg from '../assets/head outline_green.png';

// Shared color palette for consistency between Map and Overlay
export const FACE_COLORS = ['#00ff88', '#00ccff', '#ff0088', '#ffcc00'];

interface Props {
    dataRef: MutableRefObject<(FaceVector | null)[]>;
    faceCountRef: MutableRefObject<number>;
    depthNear?: number; // These are effectively overridden by edit mode now
    depthFar?: number;
}

// --- Visual Editor Overlay ---

interface EditorProps {
    minMm: number;
    maxMm: number;
    widthPct: number;
    viewMinMm: number;
    viewMaxMm: number;
    onUpdate: (updates: Partial<TrackingConfig['zone']>) => void;
}

/**
 * ZoneEditorOverlay - Interactive SVG/HTML layer for visual configuration
 */
function ZoneEditorOverlay({ minMm, maxMm, widthPct, viewMinMm, viewMaxMm, onUpdate }: EditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<'min' | 'max' | 'width' | null>(null);

    // Helpers to convert MM <-> Percent (0% is Top/Near, 100% is Bottom/Far in this view)
    const mmToPct = useCallback((mm: number) => {
        const range = viewMaxMm - viewMinMm;
        const rel = mm - viewMinMm;
        return (rel / range) * 100;
    }, [viewMinMm, viewMaxMm]);

    const pctToMm = useCallback((pct: number) => {
        const range = viewMaxMm - viewMinMm;
        return viewMinMm + (pct / 100) * range;
    }, [viewMinMm, viewMaxMm]);

    // Handle Dragging
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragging || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();

        if (dragging === 'min' || dragging === 'max') {
            const relY = e.clientY - rect.top;
            const pctY = Math.max(0, Math.min(100, (relY / rect.height) * 100));
            const newMm = pctToMm(pctY);

            if (dragging === 'min') {
                // Ensure min doesn't cross max
                onUpdate({ minDepthMm: Math.min(newMm, maxMm - 100) });
            } else {
                onUpdate({ maxDepthMm: Math.max(newMm, minMm + 100) });
            }
        }
        else if (dragging === 'width') {
            // Calculate distance from center (0.5)
            const relX = e.clientX - rect.left;
            const normX = relX / rect.width; // 0..1
            const distFromCenter = Math.abs(normX - 0.5);
            // widthPercent is total width, so 2 * distance
            const newWidth = Math.max(0.1, Math.min(1.0, distFromCenter * 2));
            onUpdate({ widthPercent: newWidth });
        }
    }, [dragging, minMm, maxMm, pctToMm, onUpdate]);

    const handleMouseUp = useCallback(() => {
        setDragging(null);
    }, []);

    useEffect(() => {
        if (dragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, handleMouseMove, handleMouseUp]);

    // Render Calculations
    const topPct = mmToPct(minMm);
    const bottomPct = mmToPct(maxMm);
    const heightPct = bottomPct - topPct;

    const wPct = widthPct * 100;
    const leftPct = (100 - wPct) / 2;

    const boxStyle: React.CSSProperties = {
        position: 'absolute',
        top: `${topPct}%`,
        left: `${leftPct}%`,
        width: `${wPct}%`,
        height: `${heightPct}%`,
        border: '2px dashed #4facfe',
        backgroundColor: 'rgba(79, 172, 254, 0.1)',
        pointerEvents: 'none'
    };

    const handleStyle: React.CSSProperties = {
        position: 'absolute',
        background: '#fff',
        borderRadius: '50%',
        width: '16px',
        height: '16px',
        transform: 'translate(-50%, -50%)',
        cursor: 'pointer',
        pointerEvents: 'auto',
        zIndex: 10,
        boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
    };

    return (
        <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5 }}>
            <div style={boxStyle} />
            <div
                style={{ ...handleStyle, top: `${topPct}%`, left: '50%', cursor: 'ns-resize' }}
                onMouseDown={() => setDragging('min')}
                title="Drag to set Step Back boundary"
            />
            <div
                style={{ ...handleStyle, top: `${bottomPct}%`, left: '50%', cursor: 'ns-resize' }}
                onMouseDown={() => setDragging('max')}
                title="Drag to set Step Closer boundary"
            />
            <div
                style={{ ...handleStyle, top: `${topPct + heightPct / 2}%`, left: `${leftPct + wPct}%`, cursor: 'ew-resize' }}
                onMouseDown={() => setDragging('width')}
                title="Drag to set Width"
            />
            <div
                style={{ ...handleStyle, top: `${topPct + heightPct / 2}%`, left: `${leftPct}%`, cursor: 'ew-resize' }}
                onMouseDown={() => setDragging('width')}
            />
        </div>
    );
}

// --- 3D Markers ---

function FaceMarkerGL({
    index,
    dataRef,
    viewMinMm,
    viewMaxMm,
    xScale = 1.0,
    color,
    zoneConfig,
    isEditMode,
    masterConfig
}: {
    index: number,
    dataRef: MutableRefObject<(FaceVector | null)[]>,
    viewMinMm: number,
    viewMaxMm: number,
    xScale?: number,
    color: string,
    zoneConfig: TrackingConfig['zone'],
    isEditMode: boolean,
    masterConfig: any // TODO: Type this properly or infer from context
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const targetPos = useRef(new THREE.Vector3(0, 0, 1));
    const targetRot = useRef(0);
    const visibleRef = useRef(false);

    const { viewport } = useThree();

    // Refs for safe closure
    const rangeRef = useRef({ min: viewMinMm, max: viewMaxMm });
    const zoneConfigRef = useRef(zoneConfig);
    const editModeRef = useRef(isEditMode);
    const masterConfigRef = useRef(masterConfig);

    useEffect(() => {
        rangeRef.current = { min: viewMinMm, max: viewMaxMm };
        zoneConfigRef.current = zoneConfig;
        editModeRef.current = isEditMode;
        masterConfigRef.current = masterConfig;
    }, [viewMinMm, viewMaxMm, zoneConfig, isEditMode, masterConfig]);

    const texture = useLoader(THREE.TextureLoader, headImg);

    useFrame((_state, delta) => {
        if (!meshRef.current) return;

        // Check availability safely
        if (dataRef.current && dataRef.current.length > index && dataRef.current[index]) {
            const face = dataRef.current[index]!;

            if (editModeRef.current) {
                visibleRef.current = true;
            } else {
                const state = getGuidanceState(face, zoneConfigRef.current);
                visibleRef.current = (state === 'ok');
            }

            if (visibleRef.current) {
                // @ts-ignore
                // meshRef.current.material.color.set(color); // Disabled tint to show texture colors

                // --- Z-AXIS MAPPING ---
                const tz = Math.abs(face.z * 1000);
                const nearVal = rangeRef.current.min;
                const farVal = rangeRef.current.max;

                const zRange = farVal - nearVal;
                const zNorm = zRange !== 0
                    ? Math.max(0, Math.min(1, (tz - nearVal) / zRange))
                    : 0.5;

                // Map to visual Y (Top-Down)
                const mapDepthRange = masterConfigRef.current?.map?.depthRange || 18; // Fallback?
                const mapY = (mapDepthRange / 2) - (zNorm * mapDepthRange);


                // --- X-AXIS MAPPING (ACTIVE WIDTH) ---
                const rawX = face.neutral_x;
                const camWidth = masterConfigRef.current?.camera?.width || 1280;
                const xNorm = rawX > 1 ? rawX / camWidth : rawX;

                // Logic:
                // If Edit Mode: View is "Full Camera" (0..1). widthFactor = 1.0.
                // If User Mode: View is "Safe Zone". widthFactor = zone.widthPercent.
                // We map the user's position relative to the Center of the camera (0.5), scaled by widthFactor.

                const widthFactor = editModeRef.current ? 1.0 : (zoneConfigRef.current?.widthPercent ?? 0.8);
                // User requested X-axis inversion due to flipped webcam feed
                const centeredX = 0.5 - xNorm;

                // Unscaled Normalized Pos (-0.5 to 0.5) / (widthFactor) => Ratio of the zone
                // e.g. if width is 0.5, and we are at 0.25 (edge), ratio = 0.5.

                // Clamp to prevent dots flying off the card in User Mode
                let xRatio = centeredX / widthFactor;

                // REMOVED CLAMPING to allow graceful exit
                // if (!editModeRef.current) {
                //      xRatio = Math.max(-0.5, Math.min(0.5, xRatio));
                // }

                // Dynamic X Range based on Viewport with Buffer
                // We use 1.2x (120%) of Width so that the dot exits the screen *before* hitting the Zone Limit (Label Trigger).
                // Zone Limit is at xRatio +/- 0.5.
                // At 0.5 * 1.2 = 0.6 viewport width (which is > 0.5 viewport width / edge).
                // This ensures "leave the edge of the grid completely before the label appears".
                const mapX = xRatio * (viewport.width * 1.2);

                targetPos.current.set(mapX, mapY, 1);
                targetRot.current = face.yaw * (Math.PI / 180);
            }
        } else {
            visibleRef.current = false;
        }

        meshRef.current.visible = visibleRef.current;

        if (visibleRef.current) {
            const smoothing = 15;
            meshRef.current.position.lerp(targetPos.current, smoothing * delta);

            // Use shorter path for rotation to avoid spinning 360
            let rotDiff = targetRot.current - meshRef.current.rotation.z;
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;

            meshRef.current.rotation.z += rotDiff * Math.min(1, smoothing * delta);
        }
    });

    return (
        <mesh ref={meshRef} renderOrder={500}>
            <planeGeometry args={[7.5, 5.5]} />
            <meshBasicMaterial
                map={texture}
                transparent
                // STENCIL BUFFER WRITE
                stencilWrite={true}
                stencilRef={1}
                stencilFunc={THREE.AlwaysStencilFunc}
                stencilZPass={THREE.ReplaceStencilOp}
                alphaTest={0.5} // Ensure transparency in texture doesn't block/write stencil
            />
        </mesh>
    );
}

function AutoZoom() {
    const { camera, size } = useThree();
    useEffect(() => {
        const targetHeightInfo = 20;
        const newZoom = size.height / targetHeightInfo;
        camera.zoom = newZoom;
        camera.updateProjectionMatrix();
    }, [camera, size]);
    return null;
}

function FpsDisplay({ dataRef }: { dataRef: MutableRefObject<any> }) {
    const { settings } = useConfig();
    const [renderFps, setRenderFps] = useState(0);
    const [trackFps, setTrackFps] = useState(0);

    // Render FPS Loop
    useEffect(() => {
        if (!settings.showFps) return;

        let frames = 0;
        let lastTime = performance.now();
        let rafId: number;

        const loop = () => {
            const now = performance.now();
            frames++;
            if (now - lastTime >= 1000) {
                setRenderFps(frames);
                frames = 0;
                lastTime = now;
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [settings.showFps]);

    // Tracking FPS Loop (Polling Ref)
    useEffect(() => {
        if (!settings.showFps) return;

        let updates = 0;
        let lastVal = dataRef.current;
        let lastReport = performance.now();

        const timer = setInterval(() => {
            if (dataRef.current !== lastVal) {
                updates++;
                lastVal = dataRef.current;
            }
            const now = performance.now();
            if (now - lastReport >= 1000) {
                setTrackFps(updates);
                updates = 0;
                lastReport = now;
            }
        }, 16);

        return () => clearInterval(timer);
    }, [settings.showFps, dataRef]);

    if (!settings.showFps) return null;

    return (
        <div style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'rgba(0,0,0,0.6)',
            color: '#00ff88',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 100
        }}>
            <div>Render: {renderFps} FPS</div>
            <div>Track: {trackFps} FPS</div>
        </div>
    );
}

function HeadOutline({ position = [0, 0, 0.1] }: { position?: [number, number, number] }) {
    const texture = useLoader(THREE.TextureLoader, headOutlineImg);
    return (
        <mesh position={new THREE.Vector3(...position)} renderOrder={0}>
            {/* Matching size of the active head: 7.5 x 5.5 */}
            <planeGeometry args={[7.5, 5.5]} />
            <meshBasicMaterial map={texture} transparent opacity={0.6} depthWrite={false} />
        </mesh>
    );
}

function HeadOutlineGreen({ position = [0, 0, 2] }: { position?: [number, number, number] }) {
    const texture = useLoader(THREE.TextureLoader, headOutlineGreenImg);
    return (
        // High Z-index to sit on top (Z=2)
        <mesh position={new THREE.Vector3(...position)} renderOrder={999}>
            <planeGeometry args={[7.5, 5.5]} />
            <meshBasicMaterial
                map={texture}
                transparent
                depthWrite={false}
                depthTest={false} /* Force Draw on Top */
                // STENCIL BUFFER READ
                stencilWrite={true}
                stencilRef={1}
                stencilFunc={THREE.EqualStencilFunc} // Only draw where Stencil == 1 (The Face)
            />
        </mesh>
    );
}

export function TopDownMapGL({ dataRef, faceCountRef }: Props) {
    const { settings, updateZoneConfig, isZoneEditMode, setZoneEditMode, masterConfig } = useConfig();
    const zoneConfig = settings.zone || { enabled: false, minDepthMm: 300, maxDepthMm: 2500, widthPercent: 0.8 };

    const EDIT_VIEW_MIN = 0;
    const EDIT_VIEW_MAX = 6000;

    const viewMinMm = isZoneEditMode ? EDIT_VIEW_MIN : zoneConfig.minDepthMm;
    const viewMaxMm = isZoneEditMode ? EDIT_VIEW_MAX : zoneConfig.maxDepthMm;

    // Create a fixed array of indices to render slots 0..3 (based on maxFaces)
    const MAX_FACES = 4;
    const slots = Array.from({ length: MAX_FACES }, (_, i) => i);

    // Layout Engine
    const layoutState = useLayoutEngine(dataRef);
    const isDuo = layoutState === 'DUO' || layoutState === 'CROWD_WARNING';

    const offset = settings.duoFaceOffset ?? 10.0;
    const isWarning = layoutState === 'CROWD_WARNING';

    // Positions: Solo (0), Duo (+/- offset)
    const outlinePositions: [number, number, number][] = isDuo
        ? [[-offset, 0, 0.1], [offset, 0, 0.1]]
        : [[0, 0, 0.1]];

    const outlineGreenPositions: [number, number, number][] = isDuo
        ? [[-offset, 0, 2], [offset, 0, 2]]
        : [[0, 0, 2]];

    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            style={{ width: '100%', height: '100%', background: '#1a1a1a', position: 'relative' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >

            <FpsDisplay dataRef={dataRef} />

            <button
                onClick={() => setZoneEditMode(!isZoneEditMode)}
                style={{
                    position: 'absolute', top: 10, left: 10, zIndex: 110,
                    background: isZoneEditMode ? '#4facfe' : 'rgba(0,0,0,0.5)',
                    border: 'none', borderRadius: 4, color: 'white', padding: '5px 10px',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    opacity: (isHovered || isZoneEditMode) ? 1 : 0,
                    transition: 'opacity 0.3s ease'
                }}
            >
                {isZoneEditMode ? 'Done' : 'Edit Zone'}
            </button>

            {/* Warning Overlay */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.8)',
                color: '#ff4444',
                fontSize: '1.5em',
                fontWeight: 'bold',
                zIndex: 30, // Above canvas but below buttons potentially
                opacity: isWarning ? 1 : 0,
                transition: 'opacity 0.5s ease-in-out',
                pointerEvents: 'none'
            }}>
                Guide disabled. More than two faces detected.
            </div>

            {/* Canvas Container with Fade */}
            <div style={{
                width: '100%', height: '100%',
                opacity: isWarning ? 0 : 1, // Fade out scene but keep faintly visible? Or 0? User said "fade out all avatars".
                // Let's go to 0 as per "fade out" usually implies hiding.
                transition: 'opacity 0.5s ease-in-out'
            }}>
                <Canvas orthographic camera={{ position: [0, 0, 10] }} gl={{ stencil: true, alpha: true }}>
                    <AutoZoom />
                    {/* UPDATED GRID: Size 40 ensures it fills the 16:9 width.
                       Height is fixed to 20 units by AutoZoom.
                       Width is approx 35.5 units (20 * 16/9).
                       Size 40 covers > 35.5, eliminating the "square box" look.
                    */}
                    <gridHelper args={[40, 40, 0x444444, 0x222222]} rotation={[Math.PI / 2, 0, 0]} />

                    {/* Static Head Outline(s) at Center (White) - Drawn First (Background) */}
                    {outlinePositions.map((pos, idx) => (
                        <HeadOutline key={`outline-${idx}`} position={pos} />
                    ))}

                    {/* Map over FIXED slots, passing the raw dataRef.
                        These Mask Writers (FaceMarker) MUST be drawn before the Mask Reader (GreenOutline)
                        if we rely on standard render order.
                    */}
                    {slots.map((i) => (
                        <FaceMarkerGL
                            key={i}
                            index={i}
                            dataRef={dataRef} // Pass the raw OneEuro filtered ref
                            viewMinMm={viewMinMm}
                            viewMaxMm={viewMaxMm}
                            color={FACE_COLORS[i % FACE_COLORS.length]}
                            zoneConfig={zoneConfig}
                            isEditMode={isZoneEditMode}
                            masterConfig={masterConfig}
                        />
                    ))}

                    {/* Green Outline Masked Overlay - Drawn Last (Foreground, masked) */}
                    {outlineGreenPositions.map((pos, idx) => (
                        <HeadOutlineGreen key={`green-${idx}`} position={pos} />
                    ))}

                </Canvas>
            </div>

            {isZoneEditMode && (
                <ZoneEditorOverlay
                    minMm={zoneConfig.minDepthMm}
                    maxMm={zoneConfig.maxDepthMm}
                    widthPct={zoneConfig.widthPercent}
                    viewMinMm={viewMinMm}
                    viewMaxMm={viewMaxMm}
                    onUpdate={updateZoneConfig}
                />
            )}

            {!isZoneEditMode && !isWarning && (
                <ZoneGuidanceOverlay
                    data={dataRef.current}
                    zoneConfig={zoneConfig}
                    cameraWidth={masterConfig?.camera?.width}
                />
            )}
        </div>
    );
}