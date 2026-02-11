/**
 * Geometry Calculation Utilities
 * Port of backend/app/utils/geometry.py
 */

export class GeometryUtils {
    /**
     * Calculate focal length in pixels from FOV.
     */
    static calculateFocalLength(imageWidth: number, fovDegrees: number): number {
        if (fovDegrees <= 0 || fovDegrees >= 180) {
            console.warn(`Invalid FOV ${fovDegrees}, defaulting to 50`);
            return (imageWidth / 2) / Math.tan((50 * Math.PI) / 360);
        }
        return (imageWidth / 2) / Math.tan((fovDegrees * Math.PI) / 360);
    }

    /**
     * Calculate distance using pinhole camera model.
     * distance = (real_width * focal_length) / pixel_width
     */
    static calculateDepth(
        pixelWidth: number,
        focalLengthPx: number,
        realWidthMm: number
    ): number {
        if (pixelWidth <= 0) return 0;
        return (realWidthMm * focalLengthPx) / pixelWidth;
    }

    /**
     * Apply cosine correction for depth based on yaw angle.
     * When head is turned, the visible ear-to-ear distance shrinks,
     * making raw depth appear larger.
     */
    static applyYawCorrection(depth: number, yawDegrees: number, maxAngle = 60.0): number {
        const safeYaw = Math.max(-maxAngle, Math.min(maxAngle, yawDegrees));
        return depth * Math.cos((safeYaw * Math.PI) / 180);
    }

    /**
     * Convert radians to degrees
     */
    static toDegrees(rad: number): number {
        return rad * (180 / Math.PI);
    }

    /**
     * Convert degrees to radians
     */
    static toRadians(deg: number): number {
        return deg * (Math.PI / 180);
    }
}