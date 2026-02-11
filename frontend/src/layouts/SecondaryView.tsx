import { FaceTrackerCard } from '../components/FaceTrackerCard';
import { useTracking } from '../contexts/TrackingContext';
import { useConfig } from '../contexts/ConfigContext';

/**
 * SecondaryView - Clean full-screen view for secondary display.
 * 
 * Shows only the face tracker card without any admin controls.
 * Used when ?mode=secondary is present in URL.
 */
export function SecondaryView() {
    const { liveFaceData } = useTracking();
    const { settings, showNeutralDot } = useConfig();

    return (
        <div
            className="secondary-view"
            style={{
                width: '100vw',
                height: '100vh',
                background: '#000'
            }}
        >
            <FaceTrackerCard
                dataRef={liveFaceData}
                showMesh={!!settings.show_mesh}
                showNeutralDot={showNeutralDot}
            />
        </div>
    );
}
