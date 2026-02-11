import { TrackingPayload } from '../types/schemas';

export interface IGestureDetector {
    id: string;
    /**
     * Update internal state with new frame data.
     * @param data The latest tracking data
     * @param timestamp Current timestamp
     * @returns True if the gesture was just detected (rising edge)
     */
    update(data: TrackingPayload, timestamp: number): boolean;

    /**
     * Reset the detector state
     */
    reset(): void;
}
