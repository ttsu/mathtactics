import { DESIGN_HEIGHT, HUD_BAR } from './designSpace';

/** Shell colours for the full-width iOS letterbox fill (matches HUD bar and Phaser clear colour). */
export const FRAME_BACKDROP = {
  hud: '#2f3e57',
  board: '#fbf7ee',
} as const;

export interface FrameBackdropPlacement {
  readonly top: number;
  readonly height: number;
  /** Where the HUD band ends as a percentage of backdrop height. */
  readonly hudStopPercent: number;
}

export function hudBandPercent(): number {
  return (HUD_BAR.height / DESIGN_HEIGHT) * 100;
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
    hudStopPercent: hudBandPercent(),
  };
}

export function frameBackdropGradient(placement: FrameBackdropPlacement): string {
  const { hud, board } = FRAME_BACKDROP;
  const stop = placement.hudStopPercent;
  return `linear-gradient(to bottom, ${hud} ${stop}%, ${board} ${stop}%)`;
}
