/**
 * Simulates the Python "Two-Tier" tracking system.
 * Extracts a square ROI around a detection to help MediaPipe initialize.
 * 
 * Supports both:
 * - Main thread: HTMLVideoElement + HTMLCanvasElement
 * - Worker thread: ImageBitmap + OffscreenCanvas
 */

type CropSource = HTMLVideoElement | ImageBitmap;
type CropTarget = HTMLCanvasElement | OffscreenCanvas;

export class CropUtils {
    /**
     * Crops a square region from the source to the target canvas.
     * @param source The video element or ImageBitmap source
     * @param box The bounding box in PIXELS {x, y, width, height}
     * @param targetCanvas The canvas to draw into (HTMLCanvasElement or OffscreenCanvas)
     * @param padding Padding factor (0.5 = 50% larger than the face)
     * @returns normalization factors to map points back to the original image
     */
    static cropToCanvas(
        source: CropSource,
        box: { x: number, y: number, width: number, height: number },
        targetCanvas: CropTarget,
        padding = 0.5
    ): { normOffsetX: number; normOffsetY: number; normScaleX: number; normScaleY: number } | null {
        const ctx = targetCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
        if (!ctx) return null;

        // Get source dimensions (different properties for video vs bitmap)
        const sourceWidth = this.getSourceWidth(source);
        const sourceHeight = this.getSourceHeight(source);

        // 1. Calculate center and size in PIXELS
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        // Ensure square crop based on the largest dimension
        const maxDim = Math.max(box.width, box.height);
        const size = maxDim * (1 + padding);

        const startX = centerX - size / 2;
        const startY = centerY - size / 2;

        // 2. Draw crop to canvas
        // Type assertion needed because TypeScript doesn't recognize the overload for OffscreenCanvas
        if (targetCanvas instanceof HTMLCanvasElement) {
            targetCanvas.width = 256;
            targetCanvas.height = 256;
        } else {
            (targetCanvas as OffscreenCanvas).width = 256;
            (targetCanvas as OffscreenCanvas).height = 256;
        }

        // drawImage accepts both HTMLVideoElement and ImageBitmap
        ctx.drawImage(
            source as CanvasImageSource,
            startX,             // Source X (Pixels)
            startY,             // Source Y (Pixels)
            size,               // Source W (Pixels)
            size,               // Source H (Pixels)
            0, 0, 256, 256      // Dest width, height
        );

        return {
            normOffsetX: startX / sourceWidth,
            normOffsetY: startY / sourceHeight,
            normScaleX: size / sourceWidth,
            normScaleY: size / sourceHeight
        };
    }

    /**
     * Get width from source (handles both video and bitmap)
     */
    private static getSourceWidth(source: CropSource): number {
        if ('videoWidth' in source) {
            return source.videoWidth;
        }
        return source.width;
    }

    /**
     * Get height from source (handles both video and bitmap)
     */
    private static getSourceHeight(source: CropSource): number {
        if ('videoHeight' in source) {
            return source.videoHeight;
        }
        return source.height;
    }
}

