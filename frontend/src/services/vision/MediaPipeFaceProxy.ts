import { TrackingConfig, TrackingPayload } from '../../types/schemas';
import { IVisionProvider } from '../../interfaces/IVisionProvider';
import { WorkerToMainMessage, toWorkerConfig } from '../../types/workerTypes';
import { TrackingBuffer } from '../../lib/tracking/TrackingBuffer';
import { MODEL_PATHS, PROCESSING_DEFAULTS, RECOVERY_DEFAULTS } from '../../../../src/shared/constants';

/**
 * The "Shell" that lives on the UI thread.
 * It strictly manages the Worker lifecycle and data marshalling.
 * It replaces the logic-heavy MediaPipeFaceProvider.
 */
export class MediaPipeFaceProxy implements IVisionProvider {
    private worker: Worker | null = null;
    private config: TrackingConfig;
    private isBusy = false;
    private isWorkerReady: boolean = false;
    private hasSentInit: boolean = false;
    // private pendingConfig: TrackingConfig | null = null; // Unused

    // We can also accept an optional onError callback
    // private onError?: (error: string) => void;

    constructor(
        config: TrackingConfig,
        private onUpdate: (data: TrackingPayload) => void,
        private onVariableUpdate: (data: { messageType: 'recording' | 'playback' | 'generic', value: any, timestamp: number }) => void,
        private onCompanionStatusChange: (isConnected: boolean) => void,
        private onError?: (error: string) => void
    ) {
        this.config = config;
        // Properties automatically assigned by private shorthand
    }

    public updateConfig(newConfig: TrackingConfig): void {
        this.config = newConfig;

        // SCENARIO 1: First Run - Send INITIALIZE instead of UPDATE
        if (!this.hasSentInit) {
            console.log("MediaPipeFaceProxy: Sending INITIALIZE command");
            if (this.worker) {
                this.worker.postMessage({
                    type: 'INITIALIZE',
                    payload: toWorkerConfig(newConfig, {
                        MODEL_PATHS,
                        PROCESSING_DEFAULTS,
                        RECOVERY_DEFAULTS
                    })
                });
                this.hasSentInit = true;
            }
            return;
        }

        // GUARD: If worker isn't ready (starting), ignore or queue.
        // Since we initialized WITH the correct config, we can likely just drop concurrent updates 
        // to avoid "setOptions" races during startup.
        if (!this.isWorkerReady) {
            console.log("MediaPipeFaceProxy: Worker starting, skipping update");
            return;
        }

        if (this.worker) {
            // Send runtime update to worker
            this.worker.postMessage({
                type: 'UPDATE_CONFIG',
                payload: toWorkerConfig(newConfig, {
                    MODEL_PATHS,
                    PROCESSING_DEFAULTS,
                    RECOVERY_DEFAULTS
                })
            });
        }
    }

    public async load(): Promise<void> {
        // 1. Instantiate the Worker
        this.worker = new Worker('./tracking.worker.js', { type: 'classic' });

        // 2. Setup Listeners
        this.worker.onmessage = (e: MessageEvent<WorkerToMainMessage>) => {
            const msg = e.data;

            if (msg.type === 'INIT_COMPLETE') {
                console.log("Worker: Initialization Complete");
                this.isWorkerReady = true;
                // No need to flush pendingConfig because INIT *was* the config
            }
            else if (msg.type === 'TRACKING_UPDATE') {
                // Pass data directly to the callback
                this.onUpdate(msg.payload);
            }
            else if (msg.type === 'VARIABLE_UPDATE') {
                this.onVariableUpdate(msg.payload);
            }
            else if (msg.type === 'COMPANION_STATUS') {
                this.onCompanionStatusChange(msg.payload.isConnected);
            }
            else if (msg.type === 'TRACKING_BUFFER') {
                // Deserialize Buffer
                const { buffer, hands, activeTriggers, pendingTriggers } = msg.payload;
                const floatArray = new Float32Array(buffer);

                // Parse faces
                const faces = TrackingBuffer.parseFaces(floatArray, this.config.maxFaces);

                // Construct Payload
                // buffer[1] is timestamp, buffer[2] is face count
                const timestamp = floatArray[1];
                const totalFaces = floatArray[2];

                const payload: TrackingPayload = {
                    type: 'TRACKING',
                    timestamp: timestamp,
                    sequence_id: floatArray[0],
                    total_faces_detected: totalFaces,
                    faces: faces,
                    hands: hands,
                    activeTriggers: activeTriggers,
                    pendingTriggers: pendingTriggers
                };

                this.isBusy = false;
                this.onUpdate(payload);
            }
            else if (msg.type === 'ERROR') {
                console.error("Worker Error:", msg.payload.message);
                this.isBusy = false;
                if (this.onError) this.onError(msg.payload.message);
            }
        };

        // 3. Send Init Configuration
        this.worker.postMessage({
            type: 'INIT',
            payload: toWorkerConfig(this.config, {
                MODEL_PATHS,
                PROCESSING_DEFAULTS,
                RECOVERY_DEFAULTS
            })
        });
    }

    public async process(video: HTMLVideoElement, timestamp: number): Promise<TrackingPayload | null> {
        if (!this.worker || this.isBusy) return null;

        this.isBusy = true;

        // 1. Create Bitmap (Zero-Copy Transfer preparation)
        // This is the ONLY "work" done on the main thread
        const bitmap = await createImageBitmap(video);

        // 2. Fire and Forget
        this.worker.postMessage(
            {
                type: 'PROCESS_FRAME',
                payload: {
                    bitmap,
                    timestamp,
                }
            },
            [bitmap] // <--- TRANSFER OWNERSHIP (Critical)
        );

        // Return null because we handle the data via the callback.
        return null;
    }

    public dispose(): void {
        this.worker?.terminate();
        this.worker = null;
    }
}
