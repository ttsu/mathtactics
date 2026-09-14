// Shared design-space geometry (TR §11.2). Framework-free so both /game/board (Phaser) and
// /game/ui (React) can import it without crossing each other's layer boundary (TR §2).
//
// Only the numbers BOTH renderers must agree on live here. Board geometry (cells, base strip,
// tray) lives in /game/board/layout.ts and is derived from these.

/** Design space: iPad 10th gen landscape, in points (GDD §3.2). */
export const DESIGN_WIDTH = 1180;
export const DESIGN_HEIGHT = 820;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The strip across the top of the design space that belongs to the React HUD. The Phaser board
 * lays out entirely below `HUD_BAR.y + HUD_BAR.height`.
 */
export const HUD_BAR: Rect = { x: 0, y: 0, width: DESIGN_WIDTH, height: 88 };

/** Minimum touch target anywhere, in points (GDD §3.2, §11.6). */
export const MIN_TOUCH_TARGET = 60;

export interface DesignSpacePlacement {
  /** Offset of the design-space origin from the container's top-left, in CSS px. */
  readonly left: number;
  readonly top: number;
  /** CSS px per design point. */
  readonly scale: number;
}

/**
 * Where to put a 1180×820 design-space layer so it sits exactly over the displayed canvas.
 * `canvas` and `container` are client rects (e.g. from `getBoundingClientRect()`).
 */
export function placementOverCanvas(
  canvas: Pick<DOMRectReadOnly, 'left' | 'top' | 'width'>,
  container: Pick<DOMRectReadOnly, 'left' | 'top'>,
): DesignSpacePlacement {
  return {
    left: canvas.left - container.left,
    top: canvas.top - container.top,
    scale: canvas.width / DESIGN_WIDTH,
  };
}
