import { ITriggerAction } from '../interfaces/ITriggerAction';
import { TrackingPayload } from './schemas';

export interface TriggerBinding {
    detectorId: string; // The ID of the detector strategy to use
    actions: ITriggerAction[]; // List of actions to execute when detected
}

export interface TriggerContext {
    timestamp: number;
    payload: TrackingPayload;
    detectorId: string;
    // Add more context here if needed (e.g. which hand triggered it)
}
