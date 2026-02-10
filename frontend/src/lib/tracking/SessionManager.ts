import { OneEuroFilter } from '../math/OneEuroFilter';
import { FaceVector } from '../../types/schemas';

interface TrackerState {
    id: number;
    framesLost: number;
    x: number; // Last known pixel X
    y: number; // Last known pixel Y

    // Smoothing Filters
    filterX: OneEuroFilter;
    filterY: OneEuroFilter;
    filterZ: OneEuroFilter;
    filterYaw: OneEuroFilter;
    filterRoll: OneEuroFilter;
    filterPitch: OneEuroFilter; // Added missing Pitch filter

    lastGeometry: FaceVector | null;
}

export class SessionManager {
    private trackers: Map<number, TrackerState> = new Map();
    private slots: (number | null)[]; // Maps slot index 0..N to tracker ID
    private nextFaceId = 0;
    private maxLostFrames = 15; // ~0.25s at 60fps

    constructor(maxSlots: number) {
        this.slots = new Array(maxSlots).fill(null);
    }

    /**
     * Update trackers with new detections from MediaPipe
     * @param detections Array of objects containing center coordinates from FaceSolver
     */
    update(detections: { x: number, y: number }[]): Map<number, number> {
        // 1. Age all trackers
        this.trackers.forEach(t => t.framesLost++);

        const matchedIndices = new Set<number>();
        const trackerToDetectionMap = new Map<number, number>();

        // 2. Match existing trackers to detections (Simple Euclidean)
        this.trackers.forEach((tracker) => {
            let bestDist = 200; // Pixel threshold (assumes scaled coordinates usually)
            let bestIdx = -1;

            detections.forEach((det, idx) => {
                if (matchedIndices.has(idx)) return;

                const dist = Math.sqrt(
                    Math.pow(det.x - tracker.x, 2) +
                    Math.pow(det.y - tracker.y, 2)
                );

                if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = idx;
                }
            });

            if (bestIdx !== -1) {
                matchedIndices.add(bestIdx);
                const match = detections[bestIdx];
                tracker.framesLost = 0;
                tracker.x = match.x;
                tracker.y = match.y;
                trackerToDetectionMap.set(tracker.id, bestIdx);
            }
        });

        // 3. Create new trackers for unmatched detections
        detections.forEach((det, idx) => {
            if (!matchedIndices.has(idx)) {
                const newId = this.nextFaceId++;
                // Initialize filters with current time and value
                const t = performance.now();

                this.trackers.set(newId, {
                    id: newId,
                    framesLost: 0,
                    x: det.x,
                    y: det.y,
                    filterX: new OneEuroFilter(t, 0), // Will be updated immediately in applySmoothing
                    filterY: new OneEuroFilter(t, 0),
                    filterZ: new OneEuroFilter(t, 0),
                    filterYaw: new OneEuroFilter(t, 0),
                    filterRoll: new OneEuroFilter(t, 0),
                    filterPitch: new OneEuroFilter(t, 0), // Initialize Pitch filter
                    lastGeometry: null
                });
                trackerToDetectionMap.set(newId, idx);
            }
        });

        // 4. Remove lost trackers
        const toRemove: number[] = [];
        this.trackers.forEach((t, id) => {
            if (t.framesLost > this.maxLostFrames) toRemove.push(id);
        });
        toRemove.forEach(id => this.trackers.delete(id));

        // 5. Assign Slots (Persistent Indices 0, 1, 2...)
        // Clear stale slots
        for (let i = 0; i < this.slots.length; i++) {
            const tid = this.slots[i];
            if (tid !== null && !this.trackers.has(tid)) {
                this.slots[i] = null;
            }
        }

        // Fill empty slots
        const sortedIds = Array.from(this.trackers.keys()).sort((a, b) => a - b);
        for (const tid of sortedIds) {
            if (!this.slots.includes(tid)) {
                const emptyIdx = this.slots.indexOf(null);
                if (emptyIdx !== -1) {
                    this.slots[emptyIdx] = tid;
                }
            }
        }

        return trackerToDetectionMap;
    }

    /**
     * Apply OneEuro filtering to geometry
     */
    applySmoothing(
        trackerId: number,
        raw: { x: number, y: number, z: number, yaw: number, roll: number, pitch: number },
        t: number
    ): { x: number, y: number, z: number, yaw: number, roll: number, pitch: number } | null {
        const tracker = this.trackers.get(trackerId);
        if (!tracker) return null;

        // Smooth
        const sx = tracker.filterX.filter(t, raw.x);
        const sy = tracker.filterY.filter(t, raw.y);
        const sz = tracker.filterZ.filter(t, raw.z);
        const syaw = tracker.filterYaw.filter(t, raw.yaw);
        const sroll = tracker.filterRoll.filter(t, raw.roll);
        // Correctly filter pitch now
        const spitch = tracker.filterPitch.filter(t, raw.pitch);

        return {
            x: sx,
            y: sy,
            z: sz,
            yaw: syaw,
            roll: sroll,
            pitch: spitch
        };
    }

    getTrackerById(id: number) {
        return this.trackers.get(id);
    }

    getSlotId(index: number) {
        return this.slots[index];
    }
}