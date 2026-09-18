// Planning-hint running totals (GDD §5.7). Pure: FIRE and the board's hint numerals share
// `applyTile`, and this walk must never consult `robot.trait`, blocked/doubled damage, or the
// outcome. Presentation decides *whether* to draw; this only answers *which* cells and values.

import type { Col, Lane } from './coords';
import { COLS } from './coords';
import { robotFootprint } from './footprint';
import type { GameData } from '../data/schemas';
import { applyTile } from './tiles';
import type { RunState } from './types';

export interface LaneHintValue {
  col: Col;
  value: number;
}

/** Column of the front-most on-board robot in `lane`, or `null` if the lane has none. Waiting
 * robots (`col: null`) are off the board and do not stop the ball (GDD §5.3, §5.7). */
function frontOnBoardRobotCol(state: RunState, lane: Lane): Col | null {
  let front: Col | null = null;
  for (const robot of state.board.robots) {
    for (const cell of robotFootprint(robot)) {
      if (cell.lane !== lane) continue;
      if (front === null || cell.col < front) front = cell.col;
    }
  }
  return front;
}

function tileDefAt(state: RunState, lane: Lane, col: Col, data: GameData) {
  const pieceId = (state.board.cells[lane] ?? [])[col] ?? null;
  if (pieceId === null) return null;
  const piece = state.pieces[pieceId];
  if (!piece) {
    throw new Error(`hints: cell ${lane},${col} references unknown piece "${pieceId}"`);
  }
  const tileDef = data.tiles.find((tile) => tile.id === piece.tileId);
  if (!tileDef) {
    throw new Error(`hints: unknown tile id "${piece.tileId}"`);
  }
  return tileDef;
}

/**
 * Running totals under each occupied tile cell in `lane` that sits strictly left of the
 * front-most on-board robot (or every occupied tile cell when the lane has none). Unarmed lanes
 * and a robot standing on column 1 return `[]`. Empty cells are skipped (no emitted value);
 * negative totals are returned as-is (GDD §2.1 — never clamped). Does not read `robot.trait`.
 *
 * Returns `{ col, value }[]` so presentation can place each numeral on the matching cell
 * without re-walking the lane.
 */
export function laneHintValues(state: RunState, lane: Lane, data: GameData): LaneHintValue[] {
  if (!state.board.cannons[lane]) return [];

  const stopCol = frontOnBoardRobotCol(state, lane) ?? COLS;
  const hints: LaneHintValue[] = [];
  let value = state.cannonBaseValue;
  for (let col = 1; col < stopCol; col++) {
    const tileCol = col as Col;
    const tileDef = tileDefAt(state, lane, tileCol, data);
    if (tileDef === null) continue;
    value = applyTile(value, tileDef);
    hints.push({ col: tileCol, value });
  }
  return hints;
}
