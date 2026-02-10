import { FaceVector } from '../types/schemas';
// import { CONFIG } from '../config'; // Removed

interface ProjectionOptions {
    xScale?: number;
    depthNear?: number;
    depthFar?: number;
    cameraWidth: number;
    cameraHeight: number;
    mapDepthRange: number;
    mapXRange: number;
}

interface ProjectedFace {
    // Three.js map coordinates
    mapX: number;
    mapY: number;
    rotation: number;

    // Percentage for DOM overlays
    xPercent: number;
    yPercent: number;
}

/**
 * Projects face data to various coordinate systems.
 * Centralizes all coordinate math in one place.
 */
export function projectFace(
    face: FaceVector,
    options: ProjectionOptions
): ProjectedFace {
    const {
        const {
            xScale = 1.0,
            cameraWidth,
            cameraHeight,
            mapDepthRange,
            mapXRange,
            depthNear = mapDepthRange * 100, // Fallback roughly compatible
            depthFar = mapDepthRange * 1000
        } = options;

    // Normalize X (handle both pixel and normalized values)
    const xNorm = face.neutral_x > 1
        ? face.neutral_x / cameraWidth
        : face.neutral_x;

    const yNorm = face.neutral_y > 1
        ? face.neutral_y / cameraHeight
        : face.neutral_y;

    // Depth in mm
    const depthMm = Math.abs(face.z * 1000);
    const depthNorm = Math.max(0, Math.min(1, (depthMm - depthNear) / (depthFar - depthNear)));

    // Three.js map projection
    // Three.js map projection
    const mapX = (xNorm - 0.5) * mapXRange * xScale;
    const mapY = (mapDepthRange / 2) - (depthNorm * mapDepthRange);

    return {
        mapX,
        mapY,
        rotation: face.yaw * (Math.PI / 180),
        xPercent: xNorm * 100,
        yPercent: yNorm * 100
    };
}
