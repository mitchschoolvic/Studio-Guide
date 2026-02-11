import { useRef, useState, useEffect } from 'react';
import { FaceVector, IncomingMessage } from '../types/schemas';

export function useTrackingData() {
    const liveFaceData = useRef<(FaceVector | null)[]>([]);
    const faceCountRef = useRef<number>(0);
    const [status, setStatus] = useState<string>("Waiting for Python...");

    useEffect(() => {
        if (!window.electronAPI) return;

        const unsubscribe = window.electronAPI.onTrackingUpdate((jsonString) => {
            try {
                const payload: IncomingMessage = JSON.parse(jsonString);
                if (payload.type === 'TRACKING') {
                    liveFaceData.current = payload.faces;
                    faceCountRef.current = payload.total_faces_detected;
                    setStatus("Connected");
                } else if (payload.type === 'STATUS') {
                    setStatus(`${payload.code}: ${payload.message}`);
                }
            } catch (e) {
                console.error("Parse Error:", e);
            }
        });

        return () => unsubscribe();
    }, []);

    return { liveFaceData, faceCountRef, status };
}
