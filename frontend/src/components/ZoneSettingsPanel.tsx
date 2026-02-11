import { useConfig } from '../contexts/ConfigContext';
import { useTracking } from '../contexts/TrackingContext';

export function ZoneSettingsPanel() {
    const { settings, updateZoneConfig, setZoneEditMode, showToast } = useConfig();
    const { liveFaceData } = useTracking();
    const zone = settings.zone || { enabled: true, minDepthMm: 300, maxDepthMm: 2500, widthPercent: 0.8 };

    return (
        <div style={{
            width: '100%', height: '100%',
            background: '#1a1a1a',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex', flexDirection: 'column',
            boxSizing: 'border-box',
            border: '1px solid #4facfe',
            position: 'relative',
            overflowY: 'auto'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <h3 style={{ margin: 0, color: '#4facfe' }}>Zone Configuration</h3>
                <button 
                    onClick={() => setZoneEditMode(false)}
                    style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2em' }}
                >
                    &times;
                </button>
            </div>

            {/* Toggle */}
            <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input 
                        type="checkbox" 
                        checked={zone.enabled} 
                        onChange={(e) => updateZoneConfig({ enabled: e.target.checked })}
                    />
                    <span style={{ fontWeight: 'bold' }}>Enable Safe Zone</span>
                </label>
            </div>

            {/* Max Depth (Step Closer) */}
            <div className="control-group" style={{ marginBottom: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <label style={{ fontSize: '0.9em', color: '#aaa' }}>Back Boundary (Step Closer)</label>
                    <span style={{ color: '#fff', fontSize: '0.9em' }}>{zone.maxDepthMm}mm</span>
                </div>
                <input
                    type="range" min="1000" max="6000" step="100"
                    value={zone.maxDepthMm}
                    onChange={(e) => updateZoneConfig({ maxDepthMm: Number(e.target.value) })}
                    style={{ width: '100%' }}
                />
                <button 
                    style={{ marginTop: 5, fontSize: '0.8em', padding: '4px 8px', background: '#333' }}
                    onClick={() => {
                         const face = liveFaceData.current?.[0];
                         if (face && face.z) {
                             updateZoneConfig({ maxDepthMm: Math.abs(face.z * 1000) });
                             showToast("Set to current position");
                         } else {
                             showToast("No face detected");
                         }
                    }}
                >
                    Set to Current Position
                </button>
            </div>

            {/* Min Depth (Step Back) */}
            <div className="control-group" style={{ marginBottom: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <label style={{ fontSize: '0.9em', color: '#aaa' }}>Front Boundary (Step Back)</label>
                    <span style={{ color: '#fff', fontSize: '0.9em' }}>{zone.minDepthMm}mm</span>
                </div>
                <input
                    type="range" min="100" max="2000" step="50"
                    value={zone.minDepthMm}
                    onChange={(e) => updateZoneConfig({ minDepthMm: Number(e.target.value) })}
                    style={{ width: '100%' }}
                />
                 <button 
                    style={{ marginTop: 5, fontSize: '0.8em', padding: '4px 8px', background: '#333' }}
                    onClick={() => {
                         const face = liveFaceData.current?.[0];
                         if (face && face.z) {
                             updateZoneConfig({ minDepthMm: Math.abs(face.z * 1000) });
                             showToast("Set to current position");
                         } else {
                             showToast("No face detected");
                         }
                    }}
                >
                    Set to Current Position
                </button>
            </div>

            {/* Width */}
            <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <label style={{ fontSize: '0.9em', color: '#aaa' }}>Active Width</label>
                    <span style={{ color: '#fff', fontSize: '0.9em' }}>{Math.round(zone.widthPercent * 100)}%</span>
                </div>
                <input
                    type="range" min="0.2" max="1.0" step="0.05"
                    value={zone.widthPercent}
                    onChange={(e) => updateZoneConfig({ widthPercent: Number(e.target.value) })}
                    style={{ width: '100%' }}
                />
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 10, fontSize: '0.8em', color: '#666', fontStyle: 'italic' }}>
                Drag the edges on the map to adjust visually.
            </div>
        </div>
    );
}