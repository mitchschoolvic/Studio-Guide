import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { IVisionProvider } from '../../interfaces/IVisionProvider';
import { TrackingConfig, TrackingPayload } from '../../types/schemas';

interface DetectedHand {
    box: { x: number, y: number, width: number, height: number };
    isLeft: boolean;
    landmarks?: { x: number, y: number, z: number }[];
}

export class MediaPipeHandProvider implements IVisionProvider {
    private config: TrackingConfig;
    private landmarker: HandLandmarker | null = null;
    private lastVideoTime: number = -1;

    constructor(config: TrackingConfig) {
        this.config = config;
    }

    public async load(): Promise<void> {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        this.landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
    }

    public async process(video: HTMLVideoElement, timestamp: number): Promise<TrackingPayload | null> {
        if (!this.landmarker) return null;

        // Simple optimization: Skip if frame hasn't changed or readyState bad
        if (video.currentTime === this.lastVideoTime || video.readyState < 2) {
            return null;
        }
        // Note: We don't update lastVideoTime here if we want to allow other providers to process the same frame time.
        // But usually, providers shouldn't care about each other. 
        // Let's rely on the caller or just update it. 
        // If we share the same video element reference across providers, this check might be tricky if not coordinated.
        // Assuming called sequentially or largely independent.

        // Actually, to implement "Process only every X ms" logic used in hook, we might add a throttle.

        const results = this.landmarker.detectForVideo(video, timestamp);

        const detectedHands: DetectedHand[] = [];

        if (results.landmarks.length > 0) {
            results.landmarks.forEach((landmarks, index) => {
                const isLeft = results.handedness[index]?.[0]?.categoryName === 'Left';

                // 1. Compute Box
                let minX = 1, minY = 1, maxX = 0, maxY = 0;
                landmarks.forEach(lm => {
                    if (lm.x < minX) minX = lm.x;
                    if (lm.y < minY) minY = lm.y;
                    if (lm.x > maxX) maxX = lm.x;
                    if (lm.y > maxY) maxY = lm.y;
                });

                const rawBox = {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                };

                // 2. Mirror Box X (Webcam mirror)
                // Logical X = 1 - (rawX + rawW)
                const mirroredX = 1 - (rawBox.x + rawBox.width);
                const handBox = { x: mirroredX, y: rawBox.y, width: rawBox.width, height: rawBox.height };

                detectedHands.push({
                    box: handBox,
                    isLeft: isLeft,
                    landmarks: landmarks.map(l => ({ x: l.x, y: l.y, z: l.z }))
                });
            });
        }

        return {
            type: "TRACKING",
            timestamp: timestamp,
            sequence_id: 0,
            total_faces_detected: 0,
            faces: [],
            hands: detectedHands
        };
    }

    public dispose(): void {
        this.landmarker?.close();
    }
}
