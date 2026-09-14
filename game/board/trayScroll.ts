// Tray scrolling (task 09 req. 2: "scrolls ... if more pieces than fit"). The tray scrolls by
// whole slots, so a piece is either fully visible or hidden — no clipping mask needed. Phaser-free.

import { TRAY_CAPACITY, TRAY_SLOT_PITCH } from './layout';

/** Largest scroll offset (in slots) for a tray holding `count` pieces. */
export function maxTrayScroll(count: number): number {
  return Math.max(0, count - TRAY_CAPACITY);
}

export function clampTrayScroll(scroll: number, count: number): number {
  return Math.min(Math.max(0, Math.round(scroll)), maxTrayScroll(count));
}

export function trayOverflows(count: number): boolean {
  return count > TRAY_CAPACITY;
}

/** Scroll offset after dragging the tray horizontally by `dxPt` design points from `startScroll`.
 * Dragging left (negative dx) reveals pieces further right, like any touch scroller. */
export function scrollAfterDrag(startScroll: number, dxPt: number, count: number): number {
  return clampTrayScroll(startScroll - dxPt / TRAY_SLOT_PITCH, count);
}

export function isTraySlotVisible(index: number, scroll: number): boolean {
  return index >= scroll && index < scroll + TRAY_CAPACITY;
}

export type TrayGesture = 'pending' | 'drag' | 'scroll';

/**
 * Decides what a press on a tray tile turns into. A tray that doesn't overflow never scrolls, so
 * the press is a tile drag straight away. An overflowing tray waits until the finger has moved
 * `thresholdPt`: mostly-horizontal movement scrolls the tray, anything else drags the tile.
 */
export function classifyTrayGesture(
  dxPt: number,
  dyPt: number,
  thresholdPt: number,
  overflowing: boolean,
): TrayGesture {
  if (!overflowing) return 'drag';
  if (Math.hypot(dxPt, dyPt) < thresholdPt) return 'pending';
  return Math.abs(dxPt) > Math.abs(dyPt) ? 'scroll' : 'drag';
}
