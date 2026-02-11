import { useState } from 'react';
import { FaceTrackerCard } from '../components/FaceTrackerCard';
import { TopDownMapGL } from '../components/TopDownMapGL';
import { ZoneSettingsPanel } from '../components/ZoneSettingsPanel'; // Import new panel
import { FitText } from '../components/common/FitText';
import { useTracking } from '../contexts/TrackingContext';
import { useConfig } from '../contexts/ConfigContext';
import { SettingsModal } from './SettingsModal';
import { TriggerStatusPanel } from '../components/infopanel/TriggerStatusPanel';

export function AdminDashboard() {
    const { liveFaceData, faceCountRef, status, isCompanionConnected, lastVariableMessage } = useTracking();
    const { calibration, isZoneEditMode } = useConfig();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <div className="app-container dashboard">
            {/* Settings Trigger */}
            <button
                className="settings-trigger-btn"
                onClick={() => setIsSettingsOpen(true)}
                title="Settings"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 24, height: 24 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l-.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>

            {/* Main Grid Dashboard */}
            <div className="dashboard-main">
                {/* Connection Status Bar */}
                <div style={{
                    position: 'absolute', top: 10, right: 10, zIndex: 999,
                    background: status === 'Connected' ? '#1a4d2e' : '#4d1a1a',
                    padding: '4px 12px', borderRadius: 4, fontSize: 12
                }}>
                    {status}
                </div>

                {/* Card 1: Face Tracker */}
                <div className="card-slot">
                    <div className="widget-card aspect-16-9-locked">
                        <FaceTrackerCard
                            dataRef={liveFaceData}
                        />
                    </div>
                </div>

                {/* Card 2: Top Down Map */}
                <div className="card-slot">
                    <div className="widget-card aspect-16-9-locked">
                        <TopDownMapGL
                            dataRef={liveFaceData}
                            faceCountRef={faceCountRef}
                            depthNear={calibration.depthNear}
                            depthFar={calibration.depthFar}
                        />
                    </div>
                </div>

                {/* Card 3: Trigger Status Panel */}
                <div className="card-slot">
                    <div className="widget-card aspect-16-9-locked" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, overflow: 'hidden' }}>
                        <TriggerStatusPanel />
                    </div>
                </div>

                {/* Card 4: Placeholder 2 OR Zone Settings OR Companion Status */}
                <div className="card-slot">
                    <div className="widget-card aspect-16-9-locked" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isZoneEditMode ? (
                            <ZoneSettingsPanel />
                        ) : (
                            lastVariableMessage ? (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    height: '100%',
                                    background: lastVariableMessage.type === 'recording' ? '#dc2626' :
                                        lastVariableMessage.type === 'playback' ? '#16a34a' : '#1f2937',
                                    color: '#ffffff',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    <div style={{ flex: 1, width: '90%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FitText
                                            text={lastVariableMessage.value}
                                            maxFontSize={300} // Allow it to get huge
                                            color="#ffffff"
                                        />
                                    </div>
                                    <span style={{ fontSize: '0.875rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', paddingBottom: '16px' }}>
                                        {lastVariableMessage.type}
                                    </span>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '12px',
                                    color: isCompanionConnected ? '#4ade80' : '#ef4444'
                                }}>
                                    {/* Icons */}
                                    {isCompanionConnected ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="15" y1="9" x2="9" y2="15"></line>
                                            <line x1="9" y1="9" x2="15" y2="15"></line>
                                        </svg>
                                    )}

                                    {/* Text */}
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                                        {isCompanionConnected ? 'Ready to Record' : 'Companion Disconnected'}
                                    </h3>

                                    {/* Subtext */}
                                    {!isCompanionConnected && (
                                        <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                                            Launch Companion Module
                                        </span>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <SettingsModal onClose={() => setIsSettingsOpen(false)} />
            )}
        </div>
    );
}