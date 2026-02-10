import { TrackingPayload } from '../types/schemas';

export interface IVisionProvider {
    /**
     * Initialize the vision model (load assets, warm up GPU)
     */
    load(): Promise<void>;

    /**
     * Process a video frame and return tracking data
     * @param input The video element or canvas to process
     * @param timestamp Current timestamp for coherence
     */
    process(input: HTMLVideoElement, timestamp: number): Promise<TrackingPayload | null> | TrackingPayload | null;

    /**
     * Clean up resources (close tensors, release GPU)
     */
    dispose(): void;
}
