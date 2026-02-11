import { useState, useEffect } from 'react';

interface UseCameraStreamOptions {
    onDisconnect?: () => void;
}

export function useCameraStream(
    deviceId: string | null,
    width = 1920,
    height = 1080,
    reconnectTrigger = 0,
    options: UseCameraStreamOptions = {}
) {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { onDisconnect } = options;

    useEffect(() => {
        let activeStream: MediaStream | null = null;
        let isCancelled = false;

        const startCamera = async () => {
            // Clear previous stream first
            setStream(null);
            setError(null);

            try {
                // Build constraints - if no deviceId, let browser pick default camera
                const constraints: MediaStreamConstraints = {
                    video: {
                        width: { ideal: width },
                        height: { ideal: height },
                        ...(deviceId ? { deviceId: { exact: deviceId } } : {})
                    }
                };

                const newStream = await navigator.mediaDevices.getUserMedia(constraints);

                if (isCancelled) {
                    // Effect was cancelled, stop tracks
                    newStream.getTracks().forEach(t => t.stop());
                    return;
                }

                activeStream = newStream;
                setStream(newStream);
                setError(null);
                console.log('[useCameraStream] Camera stream acquired successfully');
            } catch (err: any) {
                console.error("Camera Error:", err);
                if (!isCancelled) {
                    setError(err.message || "Failed to access camera");
                }
            }
        };

        startCamera();

        return () => {
            isCancelled = true;
            if (activeStream) {
                activeStream.getTracks().forEach(t => t.stop());
            }
        };
    }, [deviceId, width, height, reconnectTrigger]); // Added reconnectTrigger to dependencies

    // Listen for track ended events (camera disconnection)
    useEffect(() => {
        if (!stream) return;

        const tracks = stream.getVideoTracks();

        const handleEnded = () => {
            console.log('[useCameraStream] Camera track ended - device disconnected');
            setStream(null);
            setError('Camera disconnected');
            // Notify parent of disconnection
            if (onDisconnect) {
                onDisconnect();
            }
        };

        tracks.forEach(track => track.addEventListener('ended', handleEnded));

        return () => {
            tracks.forEach(track => track.removeEventListener('ended', handleEnded));
        };
    }, [stream, onDisconnect]);

    return { stream, error };
}