// ADVANCE (GDD §4 step 4, TR §6 "mode: 'run' details"). Pure: takes the board's robots and the
// `step` to start numbering from, returns the moved/detonating robots and the `"advance"` events.
//
// On-board robots are processed `(col asc, lane asc)` (front-most first, task 13 requirement 1).
// A robot on col 1 always leaves the board — queued to detonate (`sim/resolve/detonate.ts`
// resolves the damage later) — freeing its cell immediately for any follower processed later in
// this same sweep (a chain of adjacent robots in one lane all advance together). Otherwise a
// robot moves to `col - 1` if that cell is empty (`RobotAdvanced`), else stays (no event).
// Waiting robots (`col: null`) are never in this sweep at all.

import type { Col, Lane } from '../core/coords';
import type { Board, GameEvent, Robot } from '../core/types';

export type AdvanceDecision = { kind: 'detonate' } | { kind: 'move'; to: Col } | { kind: 'stay' };

/**
 * Pure per-robot decision (GDD §4 step 4). Exported and unit-tested directly: front-most-first
 * sweep order with speed-1 robots means the "stay" branch can never actually trigger through
 * `advance` below in v1 (task 13 context note) — this is the seam that lets the rule still be
 * proven directly, by feeding a synthetic `isOccupied`.
 */
export function decideAdvance(
  robot: Robot,
  isOccupied: (lane: Lane, col: Col) => boolean,
): AdvanceDecision {
  if (robot.col === null) {
    throw new Error(`decideAdvance: robot ${robot.robotId} is off-board (waiting)`);
  }
  if (robot.col === 1) return { kind: 'detonate' };
  const to = (robot.col - 1) as Col;
  return isOccupied(robot.lane, to) ? { kind: 'stay' } : { kind: 'move', to };
}

export interface AdvanceResult {
  /** Every robot still on the board or waiting, after this sweep (detonating robots removed). */
  robots: Robot[];
  /** Robots that left the board this step, in the order to detonate (GDD §7.2: lane order —
   * already lane-ascending here since they're all col 1, sorted `(col asc, lane asc)`). */
  detonating: Robot[];
  events: GameEvent[];
}

export function advance(board: Board, firstStep: number): AdvanceResult {
  const group = 'advance';
  let step = firstStep;
  const events: GameEvent[] = [];

  // Copies so callers' `board.robots` is never mutated (task 06/07 purity rule). `onBoard`
  // shares the same object references as `robots` (filter doesn't clone), so mutating a robot
  // found via `onBoard` updates what `isOccupied` sees for the rest of the sweep.
  const robots = board.robots.map((robot) => ({ ...robot }));
  const onBoard = robots
    .filter((robot) => robot.col !== null)
    .sort((a, b) => a.col! - b.col! || a.lane - b.lane);

  const detonating: Robot[] = [];
  const removed = new Set<string>();

  const isOccupied = (lane: Lane, col: Col): boolean =>
    robots.some((robot) => !removed.has(robot.robotId) && robot.lane === lane && robot.col === col);

  for (const robot of onBoard) {
    const decision = decideAdvance(robot, isOccupied);
    if (decision.kind === 'detonate') {
      detonating.push({ ...robot });
      removed.add(robot.robotId);
    } else if (decision.kind === 'move') {
      const from = { lane: robot.lane, col: robot.col as Col };
      robot.col = decision.to;
      events.push({
        step: step++,
        group,
        type: 'RobotAdvanced',
        robotId: robot.robotId,
        from,
        to: { lane: robot.lane, col: decision.to },
      });
    }
    // 'stay': no mutation, no event (GDD §4 step 4) — see `decideAdvance`'s doc comment for why
    // this never actually happens through this sweep in v1.
  }

  const remaining = robots.filter((robot) => !removed.has(robot.robotId));
  return { robots: remaining, detonating, events };
}
