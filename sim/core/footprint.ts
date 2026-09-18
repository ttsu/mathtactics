// Boss occupancy (GDD §6.6): a Boss is one robot that occupies a 2×2 block. `lane`/`col` on
// `Robot` are the top-front (left) cell of that block. Normal robots stay 1×1.
//
// Geometry, not tuning — the 2×2 is a design constant like LANES/COLS.

import { isCol, isLane, type Cell, type Col, type Lane } from './coords';
import type { Robot } from './types';

/** How many lanes a Boss occupies, counting downward from `robot.lane`. */
export const BOSS_FOOTPRINT_LANES = 2;
/** How many columns a Boss occupies, counting rightward from `robot.col` (the front). */
export const BOSS_FOOTPRINT_COLS = 2;

/** Normal robots enter at column 7. A Boss's front is column 6 so its back sits on 7. */
export const SPAWN_COL: Col = 7;
export const BOSS_SPAWN_COL: Col = 6;

export type Occupant = Pick<Robot, 'lane' | 'col' | 'isBoss'>;

/** Column the robot's front occupies when it first enters the board. */
export function spawnColFor(isBoss: boolean): Col {
  return isBoss ? BOSS_SPAWN_COL : SPAWN_COL;
}

/** Every on-board cell this robot occupies. Empty when waiting (`col: null`). Cells that would
 * fall off the board are omitted — a Boss authored on lane 4 is a data error, not a 1×2. */
export function robotFootprint(robot: Occupant): Cell[] {
  if (robot.col === null) return [];
  const lanesWide = robot.isBoss ? BOSS_FOOTPRINT_LANES : 1;
  const colsWide = robot.isBoss ? BOSS_FOOTPRINT_COLS : 1;
  const cells: Cell[] = [];
  for (let dLane = 0; dLane < lanesWide; dLane += 1) {
    for (let dCol = 0; dCol < colsWide; dCol += 1) {
      const lane = robot.lane + dLane;
      const col = robot.col + dCol;
      if (isLane(lane) && isCol(col) && col > 0) {
        cells.push({ lane, col });
      }
    }
  }
  return cells;
}

/** True when `cell` is one of this robot's on-board cells. */
export function robotOccupies(robot: Occupant, cell: Cell): boolean {
  return robotFootprint(robot).some((owned) => owned.lane === cell.lane && owned.col === cell.col);
}

/** Distinct lanes this on-board robot occupies, top to bottom. */
export function footprintLanes(robot: Occupant): Lane[] {
  const seen = new Set<Lane>();
  const lanes: Lane[] = [];
  for (const cell of robotFootprint(robot)) {
    if (seen.has(cell.lane)) continue;
    seen.add(cell.lane);
    lanes.push(cell.lane);
  }
  return lanes;
}

/** Lanes a spawn of this template at `lane` must keep free of other fixed spawns / letters.
 * A Boss authored on the bottom lane cannot fit — callers that validate data must reject that. */
export function reservedSpawnLanes(lane: Lane, isBoss: boolean): Lane[] {
  if (!isBoss) return [lane];
  const extra = lane + 1;
  return isLane(extra) ? [lane, extra] : [lane];
}

/** True when every cell of `incoming`'s footprint is free of the robots already on the board. */
export function footprintIsFree(robots: readonly Occupant[], incoming: Occupant): boolean {
  const cells = robotFootprint(incoming);
  if (cells.length === 0) return false;
  const expected = incoming.isBoss ? BOSS_FOOTPRINT_LANES * BOSS_FOOTPRINT_COLS : 1;
  if (cells.length !== expected) return false;
  return cells.every((cell) => !robots.some((robot) => robotOccupies(robot, cell)));
}
