import { VectorPool } from '../math/VectorPool';
import { GeometryUtils } from '../math/GeometryUtils';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface SolvedGeometry {
    centerX: number;      // Pixels
    centerY: number;      // Pixels
    depthMm: number;
    yawDeg: number;
    pitchDeg: number;
    rollDeg: number;
    landmarksNormalized: [number, number, number][];
}

export class FaceSolver {
    // MediaPipe 468 Face Mesh Indices
    private static readonly L_EAR = 234;
    private static readonly R_EAR = 454;
    private static readonly NOSE = 1;

    /**
     * Solve geometry from MediaPipe normalized landmarks
     */
    /**
     * Solve geometry from MediaPipe normalized landmarks
     * @param transformMatrix Optional 4x4 flattened matrix (column-major) from MediaPipe
     */
    static solve(
        landmarks: NormalizedLandmark[],
        imageWidth: number,
        imageHeight: number,
        fov: number,
        headWidthMm: number,
        transformMatrix?: number[]
    ): SolvedGeometry | null {
        if (!landmarks || landmarks.length === 0) return null;

        // 1. Get Key Landmarks
        const lEar = landmarks[FaceSolver.L_EAR];
        const rEar = landmarks[FaceSolver.R_EAR];
        const nose = landmarks[FaceSolver.NOSE];

        // 2. Convert to Pixels (Pooled)
        const lPx = VectorPool.get();
        lPx.x = lEar.x * imageWidth;
        lPx.y = lEar.y * imageHeight;

        const rPx = VectorPool.get();
        rPx.x = rEar.x * imageWidth;
        rPx.y = rEar.y * imageHeight;

        const nosePx = VectorPool.get();
        nosePx.x = nose.x * imageWidth;
        nosePx.y = nose.y * imageHeight;

        // 3. Roll (Head Tilt)
        const dx = rPx.x - lPx.x;
        const dy = rPx.y - lPx.y;
        const rollDeg = GeometryUtils.toDegrees(Math.atan2(dy, dx));

        // 4. Center Calculation
        let cxPx = (lPx.x + rPx.x) / 2;
        let cyPx = (lPx.y + rPx.y) / 2;


        const focalLength = GeometryUtils.calculateFocalLength(imageWidth, fov);

        // 5. Yaw (Head Turn) - CALCULATE FIRST for Correction
        const faceCenterX = (lEar.x + rEar.x) / 2; // Normalized
        const noseOffset = nose.x - faceCenterX;
        const faceWidthNorm = Math.abs(rEar.x - lEar.x);

        let yawDeg = 0.0;
        if (faceWidthNorm > 0) {
            yawDeg = GeometryUtils.toDegrees(Math.atan2(noseOffset, faceWidthNorm * 2)) * 2;
        }

        // 6. Pitch (Approximate using nose height relative to eyes)
        const eyeY = (lEar.y + rEar.y) / 2;
        const noseYOffset = nose.y - eyeY;
        const pitchDeg = noseYOffset * -100;

        // 7. Depth Calculation (Prioritize Geometric for Stability)
        // Always calculate Geometric Depth (Ear Distance) because MediaPipe Matrix Z
        // is often unstable or coupled with rotation in undesirable ways for this UI.
        const pxDist = Math.sqrt(dx * dx + dy * dy);
        let solvedDepth = 0.0;

        if (pxDist > 0) {
            solvedDepth = GeometryUtils.calculateDepth(pxDist, focalLength, headWidthMm);
            // Apply Manual Yaw Correction to decouple rotation from depth
            solvedDepth = GeometryUtils.applyYawCorrection(solvedDepth, yawDeg);
        }

        // STRATEGY A: Use Matrix for X/Y Translation (Stable Center)
        if (transformMatrix && transformMatrix.length === 16) {
            const tX = transformMatrix[12];
            const tY = transformMatrix[13];
            const tZ = transformMatrix[14];

            // Note: We IGNORE tZ for depth, using solvedDepth instead.
            // But we use tZ's sign or value to project X/Y if needed.
            const zSafe = tZ === 0 ? -1 : tZ;

            // Project 3D -> 2D using the Matrix (for Center Position only)
            const imgCx = imageWidth / 2;
            const imgCy = imageHeight / 2;

            // Only use matrix projection if it looks valid
            if (Math.abs(zSafe) > 1e-5) {
                cxPx = (tX / -tZ) * focalLength + imgCx;
                cyPx = (tY / -tZ) * focalLength + imgCy;
            }
        }
        // STRATEGY B: Usage of geometric center (cxPx, cyPx) calculated at step 4
        // (This happens automatically if we don't overwrite cxPx/cyPx above)


        // Release Pooled Vectors
        VectorPool.release(lPx);
        VectorPool.release(rPx);
        VectorPool.release(nosePx);

        // 7. Prepare full landmark list
        const lmList: [number, number, number][] = landmarks.map(lm => [lm.x, lm.y, lm.z]);

        return {
            centerX: cxPx,
            centerY: cyPx,
            depthMm: solvedDepth,
            yawDeg,
            pitchDeg,
            rollDeg,
            landmarksNormalized: lmList
        };
    }
}