import { FaceLandmarker, FaceDetector, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { TrackingWorkerConfig } from '../../types/workerTypes';

export class RecoveryEngine {
    private config: TrackingWorkerConfig | null = null;
    private faceDetector: FaceDetector | null = null; // Scout
    private sniperLandmarker: FaceLandmarker | null = null; // Sniper
    private offscreenCanvas: OffscreenCanvas | null = null;

    constructor() { }

    /**
     * Initialize the Recovery Engine with MediaPipe models
     */
    async initialize(vision: any, workerConfig: TrackingWorkerConfig): Promise<void> {
        this.config = workerConfig;
        console.log('[RecoveryEngine] Initializing...');

        try {
            // 1. Sniper Landmarker (IMAGE mode)
            console.log('[RecoveryEngine] Creating Sniper Landmarker...');
            this.sniperLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: workerConfig.modelPaths.faceLandmarker,
                    delegate: "GPU"
                },
                runningMode: "IMAGE",
                numFaces: 1,
                minFaceDetectionConfidence: workerConfig.thresholds.recoveryDetect,
                minFacePresenceConfidence: workerConfig.thresholds.recoveryDetect,
                minTrackingConfidence: workerConfig.thresholds.recoveryDetect,
            });

            // 2. Face Detector (Scout)
            console.log('[RecoveryEngine] Creating FaceDetector...');
            this.faceDetector = await FaceDetector.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: workerConfig.modelPaths.faceDetector,
                    delegate: "GPU"
                },
                runningMode: "IMAGE",
                minDetectionConfidence: workerConfig.thresholds.scoutDetect
            });

            // 3. Offscreen Canvas
            this.offscreenCanvas = new OffscreenCanvas(
                workerConfig.recovery.offscreenSize,
                workerConfig.recovery.offscreenSize
            );

            console.log('[RecoveryEngine] Initialization complete');

        } catch (err) {
            console.error('[RecoveryEngine] Initialization failed:', err);
            throw err;
        }
    }

    /**
     * Run the recovery strategy: Scout (Detector) -> Crop -> Sniper (Landmarker)
     */
    run(bitmap: ImageBitmap): FaceLandmarkerResult {
        if (!this.faceDetector || !this.sniperLandmarker || !this.offscreenCanvas || !this.config) {
            console.warn('[RecoveryEngine] Not initialized, returning empty results');
            return { faceLandmarks: [], faceBlendshapes: [] } as unknown as FaceLandmarkerResult;
        }

        const width = bitmap.width;
        const height = bitmap.height;

        // 1. Try full-frame detection (IMAGE mode = no timestamp)
        let detections = this.faceDetector.detect(bitmap);
        let foundFace = detections.detections.length > 0 ? detections.detections[0].boundingBox : null;

        // 2. If full-frame fails, try center-zoom detection
        if (!foundFace) {
            const centerSize = this.config.recovery.centerCropSize;
            const cw = width * centerSize;
            const ch = height * centerSize;
            const cx = (width - cw) / 2;
            const cy = (height - ch) / 2;

            const cropInfo = this.cropToOffscreenCanvas(bitmap, { x: cx, y: cy, width: cw, height: ch }, 0);

            if (cropInfo) {
                const zoomDetections = this.faceDetector.detect(this.offscreenCanvas);
                if (zoomDetections.detections.length > 0) {
                    const localFace = zoomDetections.detections[0].boundingBox;
                    if (localFace) {
                        foundFace = {
                            originX: cropInfo.normOffsetX * width + localFace.originX * cropInfo.normScaleX * width,
                            originY: cropInfo.normOffsetY * height + localFace.originY * cropInfo.normScaleY * height,
                            width: localFace.width * cropInfo.normScaleX * width,
                            height: localFace.height * cropInfo.normScaleY * height,
                            angle: 0
                        };
                    }
                }
            }
        }

        // 3. If found, run sniper on cropped region
        if (foundFace) {
            const cropInfo = this.cropToOffscreenCanvas(bitmap, {
                x: foundFace.originX,
                y: foundFace.originY,
                width: foundFace.width,
                height: foundFace.height
            }, this.config.recovery.sniperPadding);

            if (cropInfo) {
                // Sniper also runs in IMAGE mode
                const cropResults = this.sniperLandmarker.detect(this.offscreenCanvas);

                if (cropResults.faceLandmarks.length > 0) {
                    const localLms = cropResults.faceLandmarks[0];
                    const globalLms = localLms.map(lm => ({
                        x: cropInfo.normOffsetX + (lm.x * cropInfo.normScaleX),
                        y: cropInfo.normOffsetY + (lm.y * cropInfo.normScaleY),
                        z: lm.z
                    }));

                    return { faceLandmarks: [globalLms], faceBlendshapes: [] } as unknown as FaceLandmarkerResult;
                }
            }
        }

        return { faceLandmarks: [], faceBlendshapes: [] } as unknown as FaceLandmarkerResult;
    }

    /**
     * Helper to crop a region of the bitmap to the internal offscreen canvas
     */
    private cropToOffscreenCanvas(
        source: ImageBitmap,
        box: { x: number; y: number; width: number; height: number },
        padding = 0.5
    ): { normOffsetX: number; normOffsetY: number; normScaleX: number; normScaleY: number } | null {
        if (!this.offscreenCanvas || !this.config) return null;

        const ctx = this.offscreenCanvas.getContext('2d');
        if (!ctx) return null;

        const sourceWidth = source.width;
        const sourceHeight = source.height;

        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        const maxDim = Math.max(box.width, box.height);
        const size = maxDim * (1 + padding);

        const startX = centerX - size / 2;
        const startY = centerY - size / 2;

        // Reset canvas size if needed (though usually fixed)
        if (this.offscreenCanvas.width !== this.config.recovery.offscreenSize) {
            this.offscreenCanvas.width = this.config.recovery.offscreenSize;
            this.offscreenCanvas.height = this.config.recovery.offscreenSize;
        }

        // We need to handle out of bounds drawing potentially, but drawImage handles source clipping.
        // However, we want to maintain aspect ratio in the target square.
        // The simple approach allows distortion if we just fill the square?
        // No, we are drawing a square crop (size x size) into a square canvas (offscreenSize x offscreenSize).
        // So aspect ratio is preserved (1:1).

        ctx.drawImage(source, startX, startY, size, size, 0, 0, this.config.recovery.offscreenSize, this.config.recovery.offscreenSize);

        return {
            normOffsetX: startX / sourceWidth,
            normOffsetY: startY / sourceHeight,
            normScaleX: size / sourceWidth,
            normScaleY: size / sourceHeight
        };
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.faceDetector) {
            this.faceDetector.close();
            this.faceDetector = null;
        }
        if (this.sniperLandmarker) {
            this.sniperLandmarker.close();
            this.sniperLandmarker = null;
        }
        this.offscreenCanvas = null;
    }
}
