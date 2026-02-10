
import {
    TRACKING_BUFFER_HEADER_SIZE,
    FLOATS_PER_FACE,
    FACE_OFFSET_ID,
    FACE_OFFSET_X,
    FACE_OFFSET_Y,
    FACE_OFFSET_Z,
    FACE_OFFSET_YAW,
    FACE_OFFSET_PITCH,
    FACE_OFFSET_ROLL,
    FACE_OFFSET_NEUTRAL_X,
    FACE_OFFSET_NEUTRAL_Y,
    FACE_OFFSET_HAS_MESH,
    FACE_OFFSET_LANDMARKS_START,
    FaceVector
} from '../../types/schemas';

/**
 * Helper to manage the Shared Float32Array buffer for tracking data.
 * Layout:
 * [0] : Message Type Identifier (100) or Sequence
 * [1] : Timestamp
 * [2] : Face Count
 * [3] : Hand Count
 * [4 ... N] : Face Data Blocks
 */

export class TrackingBuffer {
    private buffer: Float32Array;
    private maxFaces: number;

    constructor(maxFaces: number) {
        this.maxFaces = maxFaces;
        // Header + (MaxFaces * FloatsPerFace)
        // We allocate enough for MAX potential faces.
        const size = TRACKING_BUFFER_HEADER_SIZE + (maxFaces * FLOATS_PER_FACE);
        this.buffer = new Float32Array(size);
    }

    public getRawBuffer(): ArrayBufferLike {
        return this.buffer.buffer;
    }

    public getFloat32Array(): Float32Array {
        return this.buffer;
    }

    public reset(): void {
        this.buffer.fill(0);
    }

    public setHeader(timestamp: number, faceCount: number, handCount: number = 0): void {
        this.buffer[0] = 100; // Magic number for "TRACKING"
        this.buffer[1] = timestamp;
        this.buffer[2] = faceCount;
        this.buffer[3] = handCount;
    }

    public setFace(index: number, face: FaceVector): void {
        if (index >= this.maxFaces) return;

        const base = TRACKING_BUFFER_HEADER_SIZE + (index * FLOATS_PER_FACE);

        this.buffer[base + FACE_OFFSET_ID] = face.id;
        this.buffer[base + FACE_OFFSET_X] = face.x;
        this.buffer[base + FACE_OFFSET_Y] = face.y;
        this.buffer[base + FACE_OFFSET_Z] = face.z;
        this.buffer[base + FACE_OFFSET_YAW] = face.yaw;
        this.buffer[base + FACE_OFFSET_PITCH] = face.pitch;
        this.buffer[base + FACE_OFFSET_ROLL] = face.roll;
        this.buffer[base + FACE_OFFSET_NEUTRAL_X] = face.neutral_x;
        this.buffer[base + FACE_OFFSET_NEUTRAL_Y] = face.neutral_y;

        if (face.landmarks && face.landmarks.length > 0) {
            this.buffer[base + FACE_OFFSET_HAS_MESH] = 1.0;
            // Write landmarks
            // landmarks is [x, y, z][]
            // We write flat x, y, z, x, y, z...
            let lmBase = base + FACE_OFFSET_LANDMARKS_START;
            for (const lm of face.landmarks) {
                this.buffer[lmBase++] = lm[0];
                this.buffer[lmBase++] = lm[1];
                this.buffer[lmBase++] = lm[2];
            }
        } else {
            this.buffer[base + FACE_OFFSET_HAS_MESH] = 0.0;
        }
    }

    /**
     * Reconstructs FaceVector objects from the buffer.
     * Useful for the Main thread to convert back to objects if needed for React.
     */
    public static parseFaces(buffer: Float32Array, maxFaces: number): (FaceVector | null)[] {
        const faces: (FaceVector | null)[] = [];

        for (let i = 0; i < maxFaces; i++) {
            const base = TRACKING_BUFFER_HEADER_SIZE + (i * FLOATS_PER_FACE);
            const id = buffer[base + FACE_OFFSET_ID];

            if (id === 0 && buffer[base + FACE_OFFSET_X] === 0) {
                faces.push(null);
                continue;
            }

            // Check for landmarks
            let landmarks: [number, number, number][] | undefined = undefined;
            if (buffer[base + FACE_OFFSET_HAS_MESH] > 0.5) {
                landmarks = [];
                let lmBase = base + FACE_OFFSET_LANDMARKS_START;
                // We don't store EXACT number of landmarks in buffer if it's constant.
                // Or we can assume 478.
                // Let's assume 478 MediaPipe standard.
                // If we want to be safe, we could store count, but schema defines strict layout.
                const NUM_LMS = 478;
                for (let j = 0; j < NUM_LMS; j++) {
                    const x = buffer[lmBase++];
                    const y = buffer[lmBase++];
                    const z = buffer[lmBase++];
                    landmarks.push([x, y, z]);
                }
            }

            faces.push({
                id: id,
                x: buffer[base + FACE_OFFSET_X],
                y: buffer[base + FACE_OFFSET_Y],
                z: buffer[base + FACE_OFFSET_Z],
                yaw: buffer[base + FACE_OFFSET_YAW],
                pitch: buffer[base + FACE_OFFSET_PITCH],
                roll: buffer[base + FACE_OFFSET_ROLL],
                neutral_x: buffer[base + FACE_OFFSET_NEUTRAL_X],
                neutral_y: buffer[base + FACE_OFFSET_NEUTRAL_Y],
                landmarks: landmarks
            });
        }
        return faces;
    }
}
