// Drag-and-drop decisions (task 09 req. 3), kept Phaser-free so they're unit-testable: what a
// press picks up, and what dropping it at a point does. The board never keeps a partial move:
// a drop either maps to exactly one planning command, or to nothing (the piece animates home).
//
// Validity mirrors the planning commands (GDD §3.3–3.4, §9.3–9.4) so an invalid target is
// rejected here — before dispatch — rather than dispatched and bounced by the sim. The sim still
// validates every command; if it ever disagrees, the board simply re-renders from the store.

import type { Cell, Lane } from '../../sim/core/coords';
import { COLS, LANES, isTileCell } from '../../sim/core/coords';
import type { Command, RunState } from '../../sim/core/types';
import {
  CELL_SIZE,
  TRAY,
  cellAtPoint,
  cellCenter,
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
  /** Nowhere valid in reach: no command, piece animates back. `hovered` is the grid cell under
   * the piece (for the "can't drop here" tint), or `null` outside the grid. */
  | { kind: 'invalid'; hovered: Cell | null };

function robotOn(run: RunState, cell: Cell): boolean {
  return run.board.robots.some((robot) => robot.lane === cell.lane && robot.col === cell.col);
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

/** Cells a dragged piece may land in: empty, unlocked tile cells for a tile (plus the cell it
 * came from); empty cannon slots for a cannon (plus its own slot). */
function landingCells(source: DragSource, run: RunState): Cell[] {
  const result: Cell[] = [];
  for (let lane = 0; lane < LANES; lane += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = { lane, col } as Cell;
      if (source.kind === 'cannon') {
        if (col === 0 && (lane === source.lane || !run.board.cannons[lane])) result.push(cell);
      } else if (isTileCell(cell.col)) {
        const isOrigin = source.kind === 'cellTile' && sameCell(source.from, cell);
        if (isOrigin || (tileOn(run, cell) === null && !robotOn(run, cell))) result.push(cell);
      }
    }
  }
  return result;
}

/**
 * What dropping `source` with its centre at `point` does. The tray area takes tiles back; on the
 * grid the target is the nearest landing cell whose centre is within `snapRadiusCells` of the
 * point on both axes (so any point inside a cell, plus a margin, snaps to it).
 */
export function resolveDrop(
  source: DragSource,
  point: Point,
  run: RunState,
  snapRadiusCells: number,
): DropResolution {
  if (rectContains(TRAY, point)) {
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

  const radius = snapRadiusCells * CELL_SIZE;
  let best: { cell: Cell; distance: number } | null = null;
  for (const cell of landingCells(source, run)) {
    const center = cellCenter(cell.lane, cell.col);
    const dx = Math.abs(point.x - center.x);
    const dy = Math.abs(point.y - center.y);
    if (dx > radius || dy > radius) continue;
    const distance = Math.hypot(dx, dy);
    if (best === null || distance < best.distance) best = { cell, distance };
  }

  if (best === null) {
    const hovered = cellAtPoint(point);
    return { kind: 'invalid', hovered: hovered === null ? null : (hovered as Cell) };
  }

  const target: DropTarget = { kind: 'cell', cell: best.cell };
  switch (source.kind) {
    case 'trayTile':
      return {
        kind: 'command',
        command: { type: 'placeTile', pieceId: source.pieceId, to: best.cell },
        target,
      };
    case 'cellTile':
      return sameCell(source.from, best.cell)
        ? { kind: 'origin', target }
        : {
            kind: 'command',
            command: { type: 'moveTile', from: source.from, to: best.cell },
            target,
          };
    case 'cannon':
      return best.cell.lane === source.lane
        ? { kind: 'origin', target }
        : {
            kind: 'command',
            command: { type: 'moveCannon', fromLane: source.lane, toLane: best.cell.lane },
            target,
          };
  }
}
