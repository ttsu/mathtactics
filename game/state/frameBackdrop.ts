/** Shell colour for the full-width iOS letterbox fill (HUD bar, main menu, end screens). */
export const FRAME_BACKDROP_COLOR = '#2f3e57';

export interface FrameBackdropPlacement {
  readonly top: number;
  readonly height: number;
}

/**
 * Full-width strip aligned to a letterboxed canvas when the viewport is wider than the canvas.
 * Returns null when the canvas already spans the viewport width.
 */
export function frameBackdropPlacement(
  canvas: Pick<DOMRectReadOnly, 'top' | 'width' | 'height'>,
  viewportWidth: number,
): FrameBackdropPlacement | null {
  if (canvas.width >= viewportWidth - 0.5) return null;
  return {
    top: canvas.top,
    height: canvas.height,
  };
}
