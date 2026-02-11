import { useEffect } from 'react';
import { useTracking } from '../contexts/TrackingContext';

interface Props {
    style?: React.CSSProperties;
    className?: string;
}

export function WebcamLayer({ style, className }: Props) {
    const { videoRef, stream } = useTracking();

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        if (stream) {
            videoEl.srcObject = stream;
            // Handle the play promise to prevent "interrupted by new load request" errors
            const playPromise = videoEl.play();

            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    // Ignore AbortError, which happens if the stream changes quickly
                    if (error.name === 'AbortError') return;
                    console.error("Autoplay failed:", error);
                });
            }
        } else {
            videoEl.srcObject = null;
        }
    }, [stream, videoRef]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // Mirror effect
                zIndex: 0,
                ...style
            }}
            className={className}
        />
    );
}