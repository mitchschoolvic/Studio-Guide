import { useUI } from '../contexts/UIContext';
import { useHardware } from '../contexts/HardwareContext';
import { useState, useEffect } from 'react';
import { FaceVector, GestureType, GestureIcons } from '../types/schemas';
import { useTracking } from '../contexts/TrackingContext';
import { useConfig } from '../contexts/ConfigContext';
import { EmailAlertSettings } from '../components/EmailAlertSettings';

interface SettingsModalProps {
    onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
    const { liveFaceData, status } = useTracking();
    const {
        settings,
        updateSettings,
        updateZoneConfig,
        handZone,
        updateHandZone,
        gestureZone,
        updateGestureZone,
        calibration,
        setDepthNear,
        setDepthFar,
        showRawData,
        setShowRawData,
        showNeutralDot,
        setShowNeutralDot,
        showGestureDebug,
        setShowGestureDebug,
        showMarkers,
        setShowMarkers,
        showGrayscale,
        setShowGrayscale
    } = useConfig();

    const {
        cameras,
        selectedCameraId,
        setSelectedCameraId,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        backendCameraIndex,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        setBackendCameraIndex,
        autoReconnectCamera,
        setAutoReconnectCamera,
        displays,
        selectedDisplayId,
        setSelectedDisplayId,
        isSecondaryOpen,
        toggleSecondary,
    } = useHardware();

    const { showToast, toastMessage } = useUI();
    const [activeTab, setActiveTab] = useState<'general' | 'zones' | 'gestures' | 'calibration' | 'debug' | 'overlays' | 'alerts'>('general');

    return (
        <div className="settings-modal-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className="settings-modal-content" style={{ position: 'relative', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
                <button className="settings-close-btn" onClick={onClose}>&times;</button>

                {/* Toast Notification */}
                <div style={{
                    position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                    background: '#00ff88', color: '#000', padding: '6px 12px',
                    borderRadius: 4, fontSize: '0.9em', fontWeight: 'bold',
                    opacity: toastMessage ? 1 : 0, pointerEvents: 'none',
                    transition: 'opacity 0.3s ease', zIndex: 1001
                }}>
                    {toastMessage || "Saved"}
                </div>

                <div style={{ marginBottom: 15 }}>
                    <h2 style={{ margin: '0 0 10px 0' }}>Settings</h2>

                    {/* Connection Indicator */}
                    <div style={{ padding: '8px 12px', background: status === 'Connected' ? '#1a4d2e' : '#4d1a1a', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'Connected' ? '#00ff88' : '#ff4444' }} />
                        <span>{status}</span>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 15, borderBottom: '1px solid #444', paddingBottom: 5 }}>
                    {(['general', 'zones', 'gestures', 'calibration', 'debug', 'overlays', 'alerts'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1,
                                padding: '8px 4px',
                                background: activeTab === tab ? '#4facfe' : 'transparent',
                                color: activeTab === tab ? '#fff' : '#888',
                                border: 'none',
                                borderRadius: '4px 4px 0 0',
                                fontWeight: activeTab === tab ? 'bold' : 'normal',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                                fontSize: '0.9em'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Scrollable Content Area */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 5 }}>

                    {/* === GENERAL TAB === */}
                    {activeTab === 'general' && (
                        <div className="tab-content">
                            {/* Camera Selection */}
                            <div className="control-group" style={{ flexDirection: 'column', gap: 10 }}>
                                <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Cameras</label>
                                <select
                                    value={selectedCameraId}
                                    onChange={(e) => setSelectedCameraId(e.target.value)}
                                    style={{ width: '100%', padding: 8, background: '#333', color: '#fff', borderRadius: 4, border: '1px solid #555' }}
                                >
                                    <option value="">Default Frontend</option>
                                    {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
                                </select>

                                {/* Auto-Reconnect Toggle */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                    <label style={{ fontSize: '0.85em', color: '#aaa' }}>Auto-Reconnect Camera</label>
                                    <input
                                        type="checkbox"
                                        checked={autoReconnectCamera}
                                        onChange={(e) => setAutoReconnectCamera(e.target.checked)}
                                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                                    />
                                </div>
                            </div>

                            {/* User Display */}
                            <div className="control-group" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 10, border: '1px solid #444', borderRadius: 4, marginTop: 15 }}>
                                <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>User Display</label>
                                <select
                                    value={selectedDisplayId}
                                    onChange={(e) => setSelectedDisplayId(Number(e.target.value))}
                                    style={{ width: '100%', padding: 8, background: '#222', color: '#fff', border: '1px solid #555', marginTop: 5, borderRadius: 4 }}
                                >
                                    {displays.map(d => <option key={d.id} value={d.id}>Display {d.id} ({d.bounds.width}x{d.bounds.height})</option>)}
                                </select>
                                <button onClick={toggleSecondary} style={{ width: '100%', marginTop: 10, padding: 8, background: isSecondaryOpen ? '#ff4444' : '#4facfe', borderRadius: 4, border: 'none', color: '#fff', fontWeight: 'bold' }}>
                                    {isSecondaryOpen ? 'Close User Display' : 'Open User Display'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* === ZONES TAB === */}
                    {activeTab === 'zones' && (
                        <div className="tab-content">
                            {/* Safe Zone Settings */}
                            <div className="control-group" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 10, border: '1px solid #4facfe', borderRadius: 4, background: '#112' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 5 }}>
                                    <label style={{ fontSize: '0.9em', fontWeight: 'bold', color: '#4facfe' }}>Safe Zone (Anti-Flicker)</label>
                                    <input
                                        type="checkbox"
                                        checked={settings.zone?.enabled ?? true}
                                        onChange={(e) => updateZoneConfig({ enabled: e.target.checked })}
                                    />
                                </div>

                                {/* Max Depth (Step Closer) */}
                                <div style={{ width: '100%', marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.8em', color: '#888' }}>Max Distance (Step Closer)</span>
                                        <span style={{ fontSize: '0.8em', color: '#fff' }}>{settings.zone?.maxDepthMm}mm</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1000" max="6000" step="100"
                                        value={settings.zone?.maxDepthMm ?? 2500}
                                        onChange={(e) => updateZoneConfig({ maxDepthMm: Number(e.target.value) })}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                {/* Min Depth (Step Back) */}
                                <div style={{ width: '100%', marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.8em', color: '#888' }}>Min Distance (Step Back)</span>
                                        <span style={{ fontSize: '0.8em', color: '#fff' }}>{settings.zone?.minDepthMm}mm</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="100" max="1000" step="50"
                                        value={settings.zone?.minDepthMm ?? 300}
                                        onChange={(e) => updateZoneConfig({ minDepthMm: Number(e.target.value) })}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                {/* Width (Step Left/Right) */}
                                <div style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.8em', color: '#888' }}>Active Width</span>
                                        <span style={{ fontSize: '0.8em', color: '#fff' }}>{Math.round((settings.zone?.widthPercent ?? 0.8) * 100)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.2" max="1.0" step="0.05"
                                        value={settings.zone?.widthPercent ?? 0.8}
                                        onChange={(e) => updateZoneConfig({ widthPercent: Number(e.target.value) })}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>


                            {/* Gesture Detection Zone */}
                            <div className="control-group" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 10, border: '1px solid #ff00de', borderRadius: 4, background: '#211', marginTop: 15 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 5 }}>
                                    <label style={{ fontSize: '0.9em', fontWeight: 'bold', color: '#ff00de' }}>Gesture Detection Zone</label>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <label style={{ fontSize: '0.8em', color: '#aaa', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            Show
                                            <input
                                                type="checkbox"
                                                checked={gestureZone?.showOverlay ?? true}
                                                onChange={(e) => updateGestureZone({ showOverlay: e.target.checked })}
                                            />
                                        </label>
                                        <input
                                            type="checkbox"
                                            checked={gestureZone?.enabled ?? true}
                                            onChange={(e) => updateGestureZone({ enabled: e.target.checked })}
                                        />
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.75em', color: '#888', margin: '0 0 8px 0' }}>
                                    Only detect gesture triggers within this zone
                                </p>

                                <div style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.8em', color: '#888' }}>Trigger Delay</span>
                                        <span style={{ fontSize: '0.8em', color: '#fff' }}>{gestureZone?.holdDurationMs ?? 150}ms</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="50" max="1000" step="50"
                                        value={gestureZone?.holdDurationMs ?? 150}
                                        onChange={(e) => updateGestureZone({ holdDurationMs: Number(e.target.value) })}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === GESTURES TAB === */}
                    {activeTab === 'gestures' && (
                        <div className="tab-content">
                            <div className="control-group" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 10, border: '1px solid #ff00de', borderRadius: 4, background: '#202' }}>
                                <label style={{ fontSize: '0.9em', fontWeight: 'bold', color: '#ff00de', marginBottom: 10 }}>Gesture Triggers (Companion)</label>

                                {[
                                    { label: 'Start Recording', key: 'startRecording' },
                                    { label: 'Stop Recording', key: 'stopRecording' },
                                    { label: 'Start Playback', key: 'startPlayback' },
                                    { label: 'Stop Playback', key: 'stopPlayback' }
                                ].map(item => (
                                    <div key={item.key} style={{ width: '100%', marginBottom: 8 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8em', color: '#ccc' }}>{item.label}</span>
                                            <label style={{ fontSize: '0.7em', color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                Show
                                                <input
                                                    type="checkbox"
                                                    checked={settings.gestureVisibility?.[item.key] ?? true}
                                                    onChange={(e) => {
                                                        const isVisible = e.target.checked;
                                                        const currentVisibility = settings.gestureVisibility || {};
                                                        updateSettings({
                                                            gestureVisibility: {
                                                                ...currentVisibility,
                                                                [item.key]: isVisible
                                                            }
                                                        });
                                                    }}
                                                />
                                            </label>
                                        </div>
                                        <select
                                            value={settings.gestures?.[item.key as keyof typeof settings.gestures] || 'None'}
                                            onChange={(e) => {
                                                const val = e.target.value as GestureType;
                                                updateSettings({
                                                    gestures: {
                                                        ...(settings.gestures || {
                                                            startRecording: GestureType.None,
                                                            stopRecording: GestureType.None,
                                                            startPlayback: GestureType.None,
                                                            stopPlayback: GestureType.None
                                                        }),
                                                        [item.key]: val
                                                    }
                                                });
                                            }}
                                            style={{ width: '100%', padding: 6, background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4 }}
                                        >
                                            {Object.values(GestureType).map(g => (
                                                <option key={g} value={g}>{GestureIcons[g].icon} {GestureIcons[g].label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* === CALIBRATION TAB === */}
                    {activeTab === 'calibration' && (
                        <div className="tab-content">
                            {/* Neutral Eye Offset */}
                            <div className="control-group" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                    <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Neutral Eye Offset</label>
                                    <span style={{ fontSize: '0.8em', color: '#00ff88' }}>{settings.eyeOffsetPx}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="-200"
                                    max="200"
                                    value={settings.eyeOffsetPx || 0}
                                    onChange={(e) => {
                                        updateSettings({ eyeOffsetPx: Number(e.target.value) });
                                    }}
                                    onMouseUp={(e) => {
                                        const val = Number((e.target as HTMLInputElement).value);
                                        window.electronAPI?.saveCameraConfig({ eyeOffset: val });
                                        // Force update tracking config immediately
                                        window.electronAPI?.updateTrackingConfig({ eyeOffsetPx: val });
                                        showToast("Offset Saved");
                                    }}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            {/* Avatar Split Gap */}
                            <div className="control-group" style={{ flexDirection: 'column', alignItems: 'flex-start', marginTop: 15 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                    <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Avatar Split Gap</label>
                                    <span style={{ fontSize: '0.8em', color: '#00ff88' }}>{Math.round((settings.duoFaceOffset ?? 10.0) * 10) / 10}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    step="0.5"
                                    value={settings.duoFaceOffset ?? 10.0}
                                    onChange={(e) => {
                                        updateSettings({ duoFaceOffset: Number(e.target.value) });
                                    }}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            {/* Z-Depth Calibration */}
                            <div className="control-group" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 10, border: '1px solid #444', borderRadius: 4, marginTop: 15 }}>
                                <label style={{ fontSize: '0.9em', fontWeight: 'bold', color: '#ff88aa', marginBottom: 8 }}>Z-Depth Visualization Range</label>
                                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                                    <button
                                        style={{ flex: 1, padding: '12px 4px', background: '#2a4d3e', border: '1px solid #00ff88', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 4, cursor: 'pointer' }}
                                        onClick={() => {
                                            const face = liveFaceData.current?.[0];
                                            if (face && face.z !== undefined) {
                                                setDepthNear(Math.abs(face.z * 1000));
                                            } else {
                                                showToast("No face detected");
                                            }
                                        }}
                                    >
                                        <span style={{ fontSize: '0.8em', fontWeight: 'bold' }}>Set Near</span>
                                        <span style={{ fontSize: '0.7em', color: '#00ff88' }}>{Math.round(calibration.depthNear)}mm</span>
                                    </button>
                                    <button
                                        style={{ flex: 1, padding: '12px 4px', background: '#4d2a2a', border: '1px solid #ff4444', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 4, cursor: 'pointer' }}
                                        onClick={() => {
                                            const face = liveFaceData.current?.[0];
                                            if (face && face.z !== undefined) {
                                                setDepthFar(Math.abs(face.z * 1000));
                                            } else {
                                                showToast("No face detected");
                                            }
                                        }}
                                    >
                                        <span style={{ fontSize: '0.8em', fontWeight: 'bold' }}>Set Far</span>
                                        <span style={{ fontSize: '0.7em', color: '#ff4444' }}>{Math.round(calibration.depthFar)}mm</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === DEBUG TAB === */}
                    {activeTab === 'debug' && (
                        <div className="tab-content">
                            {/* Toggles */}
                            <div className="control-group" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                <button onClick={() => updateSettings({ showMesh: !settings.showMesh })} style={{ flex: '1 1 45%', padding: 8 }}>
                                    Mesh {settings.showMesh ? "✅" : "❌"}
                                </button>
                                <button onClick={() => updateSettings({ showFps: !settings.showFps })} style={{ flex: '1 1 45%', padding: 8 }}>
                                    FPS {settings.showFps ? "✅" : "❌"}
                                </button>
                                <button onClick={() => setShowNeutralDot(!showNeutralDot)} style={{ flex: '1 1 45%', padding: 8 }}>
                                    Neutral Dot {showNeutralDot ? "✅" : "❌"}
                                </button>
                                <button onClick={() => setShowGestureDebug(!showGestureDebug)} style={{ flex: '1 1 45%', padding: 8 }}>
                                    Gestures {showGestureDebug ? "✅" : "❌"}
                                </button>
                            </div>

                            {/* Stats */}
                            <div className="stats" style={{ marginTop: 15, padding: 10, background: '#111', borderRadius: 4 }}>
                                <p style={{ margin: 0 }}>Faces Detected: <FaceCount dataRef={liveFaceData} /></p>
                            </div>

                            <button
                                onClick={() => window.electronAPI?.openConfigLocation()}
                                style={{ marginTop: 15, width: '100%', background: '#444', border: '1px solid #666', padding: 8, borderRadius: 4, cursor: 'pointer', color: '#fff' }}
                            >
                                Open Config Folder
                            </button>

                            <button
                                onClick={() => window.electronAPI?.openLogLocation()}
                                style={{ marginTop: 8, width: '100%', background: '#444', border: '1px solid #666', padding: 8, borderRadius: 4, cursor: 'pointer', color: '#fff' }}
                            >
                                Open Log Folder
                            </button>

                            <button onClick={() => setShowRawData(!showRawData)} style={{ marginTop: 15, fontSize: '0.8em', background: 'transparent', border: '1px solid #444', width: '100%', padding: 5, color: '#aaa' }}>
                                Debug JSON {showRawData ? "(ON)" : "(OFF)"}
                            </button>

                            {showRawData && <RawDataViewer dataRef={liveFaceData} />}
                        </div>
                    )}

                    {/* === OVERLAYS TAB === */}
                    {activeTab === 'overlays' && (
                        <div className="tab-content">
                            <div className="control-group" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {/* Grayscale Toggle */}
                                <button
                                    onClick={() => setShowGrayscale(!showGrayscale)}
                                    style={{ flex: '1 1 100%', padding: '10px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, cursor: 'pointer' }}
                                >
                                    Grayscale {showGrayscale ? '✅' : '❌'}
                                </button>

                                {/* Glasses Toggle */}
                                <button
                                    onClick={() => updateSettings({
                                        overlay: {
                                            ...(settings.overlay || { x: 0.5, y: 0.5, scale: 1.0 }),
                                            enabled: !settings.overlay?.enabled
                                        }
                                    })}
                                    style={{ flex: '1 1 100%', padding: '10px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, cursor: 'pointer' }}
                                >
                                    Glasses {settings.overlay?.enabled ? '✅' : '❌'}
                                </button>

                                {/* Markers Toggle */}
                                <button
                                    onClick={() => setShowMarkers(!showMarkers)}
                                    style={{ flex: '1 1 100%', padding: '10px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, cursor: 'pointer' }}
                                >
                                    Markers {showMarkers ? '✅' : '❌'}
                                </button>
                            </div>
                        </div>

                    )}

                    {/* === ALERTS TAB === */}
                    {activeTab === 'alerts' && (
                        <div className="tab-content">
                            <EmailAlertSettings
                                alertConfig={settings.alerts}
                                onSave={(config) => updateSettings({ alerts: config })}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}

function FaceCount({ dataRef }: { dataRef: React.MutableRefObject<(FaceVector | null)[]> }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            const validFaces = dataRef.current ? dataRef.current.filter(f => f !== null).length : 0;
            setCount(validFaces);
        }, 500);
        return () => clearInterval(interval);
    }, [dataRef]);
    return <span>{count}</span>;
}

function RawDataViewer({ dataRef }: { dataRef: React.MutableRefObject<(FaceVector | null)[]> }) {
    const [snap, setSnap] = useState("Waiting for data...");

    useEffect(() => {
        const interval = setInterval(() => {
            if (dataRef.current && dataRef.current.length > 0) {
                const cleanData = dataRef.current.map(face => {
                    if (!face) return null;
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { landmarks, ...rest } = face;
                    return { ...rest, _landmarks_mode: "hidden" };
                });
                setSnap(JSON.stringify(cleanData, null, 2));
            } else {
                setSnap("No Faces Detected");
            }
        }, 200);
        return () => clearInterval(interval);
    }, [dataRef]);

    return (
        <div style={{
            marginTop: 10, padding: 10, background: 'rgba(0,0,0,0.8)', color: '#0f0',
            fontFamily: 'monospace', fontSize: 10, maxHeight: 300, overflow: 'auto',
            border: '1px solid #0f0', textAlign: 'left', whiteSpace: 'pre-wrap'
        }}>
            <strong>Live Coordinates:</strong>
            <hr style={{ borderColor: '#333' }} />
            {snap}
        </div>
    );
}