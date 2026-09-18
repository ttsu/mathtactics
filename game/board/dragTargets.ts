// Drag-and-drop decisions (task 09 req. 3), kept Phaser-free so they're unit-testable: what a
// press picks up, and what dropping it with the finger at a point does. The board never keeps a partial move:
// a drop either maps to exactly one planning command, or to nothing (the piece animates home).
//
// Validity mirrors the planning commands (GDD §3.3–3.4, §9.3–9.4) so an invalid target is
// rejected here — before dispatch — rather than dispatched and bounced by the sim. The sim still
// validates every command; if it ever disagrees, the board simply re-renders from the store.

import type { Cell, Lane } from '../../sim/core/coords';
import { COLS, LANES, isTileCell } from '../../sim/core/coords';
import { robotOccupies } from '../../sim/core/footprint';
import type { Command, RunState } from '../../sim/core/types';
import {
  CELL_SIZE,
  TRAY,
  cellAtPoint,
  cellCenter,
  cellFaceAtPoint,
  rectContains,
  traySlotAtPoint,
  type Point,
} from './layout';

export type DragSource =
  | { kind: 'trayTile'; pieceId: string; index: number }
  | { kind: 'cellTile'; pieceId: string; from: Cell }
  | { kind: 'cannon'; lane: Lane };

export type DropTarget = { kind: 'cell'; cell: Cell } | { kind: 'tray' };

export type DropResolution =
  /** Dropping here dispatches `command`; `target` is where the piece will end up. */
  | { kind: 'command'; command: Command; target: DropTarget }
  /** Back where it came from: no command. */
  | { kind: 'origin'; target: DropTarget }
  /** Nowhere valid: no command, piece animates back. `hovered` is the blocked cell under the
   * finger (for the "can't drop here" tint), or `null` when the finger isn't on a cell. */
  | { kind: 'invalid'; hovered: Cell | null };

function robotOn(run: RunState, cell: Cell): boolean {
  return run.board.robots.some((robot) => robotOccupies(robot, cell));
}

function tileOn(run: RunState, cell: Cell): string | null {
  return run.board.cells[cell.lane]?.[cell.col] ?? null;
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.lane === b.lane && a.col === b.col;
}

/** What a press at design point `point` picks up, or `null`. A tile under a robot is locked and
 * can't be picked up (GDD §3.4). `trayScroll` is the tray's current scroll offset in slots. */
export function pickUpAt(point: Point, run: RunState, trayScroll: number): DragSource | null {
  const slot = traySlotAtPoint(point);
  if (slot !== null) {
    const index = slot + trayScroll;
    const pieceId = run.tray[index];
    return pieceId === undefined ? null : { kind: 'trayTile', pieceId, index };
  }

  const hit = cellAtPoint(point);
  if (hit === null) return null;
  const cell = hit as Cell;
  if (!isTileCell(cell.col)) {
    return run.board.cannons[cell.lane] ? { kind: 'cannon', lane: cell.lane } : null;
  }
  const pieceId = tileOn(run, cell);
  if (pieceId === null || robotOn(run, cell)) return null;
  return { kind: 'cellTile', pieceId, from: cell };
}

/** Where a held piece is drawn: a little above the finger so it isn't hidden. Visual only —
 * drops always resolve at the finger point (task 09 fix round 1 ruling). */
export function heldPieceCenter(finger: Point, fingerOffsetPt: number): Point {
  return { x: finger.x, y: finger.y - fingerOffsetPt };
}

/** Whether `source` may land in `cell`, and whether that's where it came from. */
function landing(source: DragSource, run: RunState, cell: Cell): 'origin' | 'valid' | 'blocked' {
  if (source.kind === 'cannon') {
    if (isTileCell(cell.col)) return 'blocked';
    if (cell.lane === source.lane) return 'origin';
    return run.board.cannons[cell.lane] ? 'blocked' : 'valid';
  }
  if (!isTileCell(cell.col)) return 'blocked';
  if (source.kind === 'cellTile' && sameCell(source.from, cell)) return 'origin';
  return tileOn(run, cell) === null && !robotOn(run, cell) ? 'valid' : 'blocked';
}

/**
 * What dropping `source` with the finger at design point `finger` does (task 09 fix round 1
 * ruling — the finger, not the lifted piece, decides):
 * - finger in the tray area: board tile → `returnTile`; tray tile → nothing;
 * - finger on a cell's face: that cell alone decides — valid → command, its own origin → nothing,
 *   locked/occupied/wrong column → invalid (and it's the hovered cell for the red tint);
 * - finger in the gutter between cells or just outside the grid: the nearest valid (or origin)
 *   cell whose centre is within `snapRadiusCells` on both axes; none in reach → invalid.
 */
export function resolveDrop(
  source: DragSource,
  finger: Point,
  run: RunState,
  snapRadiusCells: number,
): DropResolution {
  if (rectContains(TRAY, finger)) {
    switch (source.kind) {
      case 'trayTile':
        return { kind: 'origin', target: { kind: 'tray' } };
      case 'cellTile':
        return {
          kind: 'command',
          command: { type: 'returnTile', from: source.from },
          target: { kind: 'tray' },
        };
      case 'cannon':
        return { kind: 'invalid', hovered: null };
    }
  }

  const face = cellFaceAtPoint(finger);
  if (face !== null) {
    const cell = face as Cell;
    const kind = landing(source, run, cell);
    return kind === 'blocked' ? { kind: 'invalid', hovered: cell } : dropOnto(source, cell, kind);
  }

  const radius = snapRadiusCells * CELL_SIZE;
  let best: { cell: Cell; kind: 'origin' | 'valid'; distance: number } | null = null;
  for (let lane = 0; lane < LANES; lane += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = { lane, col } as Cell;
      const kind = landing(source, run, cell);
      if (kind === 'blocked') continue;
      const center = cellCenter(lane, col);
      const dx = Math.abs(finger.x - center.x);
      const dy = Math.abs(finger.y - center.y);
      if (dx > radius || dy > radius) continue;
      const distance = Math.hypot(dx, dy);
      if (best === null || distance < best.distance) best = { cell, kind, distance };
    }
  }
  return best === null
    ? { kind: 'invalid', hovered: null }
    : dropOnto(source, best.cell, best.kind);
}

function dropOnto(source: DragSource, cell: Cell, kind: 'origin' | 'valid'): DropResolution {
  const target: DropTarget = { kind: 'cell', cell };
  if (kind === 'origin') return { kind: 'origin', target };
  switch (source.kind) {
    case 'trayTile':
      return {
        kind: 'command',
        command: { type: 'placeTile', pieceId: source.pieceId, to: cell },
        target,
      };
    case 'cellTile':
      return {
        kind: 'command',
        command: { type: 'moveTile', from: source.from, to: cell },
        target,
      };
    case 'cannon':
      return {
        kind: 'command',
        command: { type: 'moveCannon', fromLane: source.lane, toLane: cell.lane },
        target,
      };
  }
}
