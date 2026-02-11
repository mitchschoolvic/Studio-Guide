import { TrackingConfig, TrackingPayload } from '../types/schemas';
import { MediaPipeFaceProxy } from './vision/MediaPipeFaceProxy';

type TrackingEventHandler = (data: TrackingPayload) => void;

export class TrackingService {
    private faceProvider: MediaPipeFaceProxy;

    // State
    private isRunning: boolean = false;
    private rafId: number | null = null;
    private lastCaptureTime: number = 0;
    private readonly CAPTURE_INTERVAL_MS = 33;

    // Events & Config
    private listeners: TrackingEventHandler[] = [];
    private companionStatusListeners: ((isConnected: boolean) => void)[] = [];
    private variableListeners: ((data: { messageType: 'recording' | 'playback' | 'generic', value: any, timestamp: number }) => void)[] = [];
    private config: TrackingConfig;

    constructor(config: TrackingConfig) {
        this.config = config;

        // Initialize Components
        this.faceProvider = new MediaPipeFaceProxy(
            config,
            (data) => this.handleTrackingUpdate(data),
            (data) => this.handleVariableUpdate(data),
            (isConnected) => this.handleCompanionStatusChange(isConnected),
            (err) => console.error('[TrackingService] Proxy error:', err)
        );
    }

    /**
     * SINGLE SOURCE OF TRUTH ENFORCEMENT
     * When config changes, we must tear down old detectors and build new ones.
     */
    public updateConfig(newConfig: TrackingConfig) {
        // console.log('[TrackingService] Config updated.');
        this.config = newConfig;

        // Propagate config to sub-engines if they need it
        this.faceProvider.updateConfig(newConfig);
    }

    private handleTrackingUpdate(payload: TrackingPayload) {
        // Payload now comes pre-populated with activeTriggers from the Worker
        this.emit(payload);
    }

    private handleVariableUpdate(data: { messageType: 'recording' | 'playback' | 'generic', value: any, timestamp: number }) {
        // console.log('[TrackingService] Variable Update:', data);
        this.emitVariable(data);
    }

    // --- Standard Service Boilerplate ---

    public async initialize(): Promise<void> {
        return this.faceProvider.load();
    }

    public start(videoElement: HTMLVideoElement) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.loop(videoElement);
    }

    public stop() {
        this.isRunning = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    public dispose() {
        this.stop();
        this.faceProvider.dispose();
        this.listeners = [];
    }

    public on(event: 'tracking-update', handler: TrackingEventHandler): void;
    public on(event: 'companion-status', handler: (isConnected: boolean) => void): void;
    public on(event: 'variable-update', handler: (data: { messageType: 'recording' | 'playback' | 'generic', value: any, timestamp: number }) => void): void;
    public on(event: string, handler: any) {
        if (event === 'tracking-update') this.listeners.push(handler);
        if (event === 'companion-status') this.companionStatusListeners.push(handler);
        if (event === 'variable-update') this.variableListeners.push(handler);
    }

    public off(event: 'tracking-update', handler: TrackingEventHandler): void;
    public off(event: 'companion-status', handler: (isConnected: boolean) => void): void;
    public off(event: 'variable-update', handler: (data: { messageType: 'recording' | 'playback' | 'generic', value: any, timestamp: number }) => void): void;
    public off(event: string, handler: any) {
        if (event === 'tracking-update') this.listeners = this.listeners.filter(h => h !== handler);
        if (event === 'companion-status') this.companionStatusListeners = this.companionStatusListeners.filter(h => h !== handler);
        if (event === 'variable-update') this.variableListeners = this.variableListeners.filter(h => h !== handler);
    }

    private emit(data: TrackingPayload) {
        this.listeners.forEach(l => l(data));
    }

    private emitVariable(data: { messageType: 'recording' | 'playback' | 'generic', value: any, timestamp: number }) {
        this.variableListeners.forEach(l => l(data));
    }

    private handleCompanionStatusChange(isConnected: boolean) {
        this.companionStatusListeners.forEach(l => l(isConnected));
    }

    private async loop(video: HTMLVideoElement) {
        if (!this.isRunning) return;
        const now = performance.now();

        // --- ADDED LOGGING START ---
        // Log status if we are "stuck" (waiting more than 2 seconds without processing)
        if (now - this.lastCaptureTime > 2000) {
            const readyStateMap = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
            console.warn(`[TrackingService] Loop stalled. Video State: ${readyStateMap[video.readyState]} (${video.readyState}), Paused: ${video.paused}, Ended: ${video.ended}`);

            // Attempt recovery if stuck in paused state
            if (video.paused && video.srcObject) {
                console.log("[TrackingService] Attempting to force play video...");
                video.play().catch(e => console.error("Force play failed:", e));
            }

            // Reset timer to avoid spamming logs every frame
            this.lastCaptureTime = now;
        }
        // --- ADDED LOGGING END ---

        if (now - this.lastCaptureTime >= this.CAPTURE_INTERVAL_MS && video.readyState >= 2) {
            this.lastCaptureTime = now;
            try {
                await this.faceProvider.process(video, now);
            } catch (err) {
                // error handling
            }
        }

        if (this.isRunning) {
            this.rafId = requestAnimationFrame(() => this.loop(video));
        }
    }
}