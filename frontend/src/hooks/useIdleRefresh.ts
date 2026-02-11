import { useEffect, useRef } from 'react';

const DEFAULT_TIMEOUT = 2 * 60 * 60 * 1000; // 2 Hours
const CHECK_INTERVAL = 10 * 1000; // Check every 10 seconds

/**
 * Hook to automatically refresh the page after a period of inactivity,
 * unless a face is currently detected.
 * 
 * @param faceCountRef Reference to the current number of detected faces
 * @param timeoutMs Duration in milliseconds of inactivity before refresh (default 2 hours)
 */
export function useIdleRefresh(
    faceCountRef: React.MutableRefObject<number>,
    timeoutMs: number = DEFAULT_TIMEOUT
) {
    const lastActivityRef = useRef<number>(Date.now());

    useEffect(() => {
        const updateActivity = () => {
            lastActivityRef.current = Date.now();
        };

        // Listen for user interaction
        // Pass specific options to make listeners passive where applicable for performance
        window.addEventListener('mousemove', updateActivity, { passive: true });
        window.addEventListener('keydown', updateActivity, { passive: true });
        window.addEventListener('mousedown', updateActivity, { passive: true });
        window.addEventListener('touchstart', updateActivity, { passive: true });

        const interval = setInterval(() => {
            const now = Date.now();
            const timeSinceActivity = now - lastActivityRef.current;

            if (timeSinceActivity > timeoutMs) {
                // Check Face Guard
                // We access the ref directly to get the latest value without causing re-renders
                if (faceCountRef.current > 0) {
                    console.log(`[IdleRefresh] Idle for ${(timeSinceActivity / 1000).toFixed(0)}s but Face Detected. Resetting timer.`);
                    lastActivityRef.current = now; // Reset timer as if interaction happened
                } else {
                    console.log(`[IdleRefresh] Idle for ${(timeSinceActivity / 1000).toFixed(0)}s and No Faces. Refreshing...`);
                    window.location.reload();
                }
            }
        }, CHECK_INTERVAL);

        return () => {
            window.removeEventListener('mousemove', updateActivity);
            window.removeEventListener('keydown', updateActivity);
            window.removeEventListener('mousedown', updateActivity);
            window.removeEventListener('touchstart', updateActivity);
            clearInterval(interval);
        };
    }, [timeoutMs, faceCountRef]); // faceCountRef is stable
}
