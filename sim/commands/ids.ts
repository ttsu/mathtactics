// Stable id allocation (TR §4: `RunState.nextIds`). Pure: takes the current counters and
// returns both the new id and the counters to use for the *next* allocation, so callers thread
// state instead of mutating a shared counter.

import type { RunState } from '../core/types';

type NextIds = RunState['nextIds'];

export function allocatePieceId(nextIds: NextIds): [pieceId: string, next: NextIds] {
  return [`piece:${nextIds.piece}`, { ...nextIds, piece: nextIds.piece + 1 }];
}

export function allocateRobotId(nextIds: NextIds): [robotId: string, next: NextIds] {
  return [`robot:${nextIds.robot}`, { ...nextIds, robot: nextIds.robot + 1 }];
}

/** One ball id per fired ball (task 07: `/sim/resolve/fire.ts`). */
export function allocateBallId(nextIds: NextIds): [ballId: string, next: NextIds] {
  return [`ball:${nextIds.ball}`, { ...nextIds, ball: nextIds.ball + 1 }];
}
