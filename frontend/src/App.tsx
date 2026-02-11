import { useState, useEffect } from 'react';
import { TrackingProvider } from './contexts/TrackingContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { UIProvider } from './contexts/UIContext';
import { HardwareProvider } from './contexts/HardwareContext';
import { AdminDashboard } from './layouts/AdminDashboard';
import { SecondaryView } from './layouts/SecondaryView';
import { useIdleRefresh } from './hooks/useIdleRefresh';
import { useTracking } from './contexts/TrackingContext';
import './App.css';

/**
 * App - Thin router component.
 * 
 * Responsibilities:
 * - Determine view mode (Admin vs Secondary)
 * - Wrap with Context Providers
 * - Route to appropriate layout
 */
/**
 * Inner component to handle Config Loading State
 * Must be child of ConfigProvider
 */
import { useConfig } from './contexts/ConfigContext';


function IdleMonitor() {
  const { faceCountRef } = useTracking();
  useIdleRefresh(faceCountRef);
  return null;
}

function AppContent() {
  const [isAdmin, setIsAdmin] = useState(true);
  const { isLoading } = useConfig();

  // Check mode from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'secondary') {
      setIsAdmin(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#1a1a1a',
        color: '#fff',
        fontFamily: 'monospace'
      }}>
        INITIALIZING...
      </div>
    );
  }

  return (
    <HardwareProvider>
      <TrackingProvider>
        <IdleMonitor />
        {isAdmin ? <AdminDashboard /> : <SecondaryView />}
      </TrackingProvider>
    </HardwareProvider>
  );
}

function App() {
  return (
    <UIProvider>
      <ConfigProvider>
        <AppContent />
      </ConfigProvider>
    </UIProvider>
  );
}

export default App;