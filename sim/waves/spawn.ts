// The SPAWN step (GDD §4 step 1, TR §6). Pure: returns a new state and the `"spawn"` events.
//
// Order: robots already waiting off-board first (in `board.robots` order — they were scheduled
// earlier), then pending entries due this turn (`turn <= state.turn`), in schedule order. Each
// enters col 7 of its lane if no robot is there (`RobotSpawned`); otherwise it waits off-board with
// `col: null`. Only a newly scheduled robot emits `RobotWaiting` — one still waiting emits nothing.

import type { Col, Lane } from '../core/coords';
import type { GameEvent, Robot, RunState } from '../core/types';
import type { GameData } from '../data/schemas';
import { allocateRobotId } from '../commands/ids';

/** Robots enter the board at the far right (GDD §3.1). */
export const SPAWN_COL: Col = 7;

export interface SpawnResult {
  state: RunState;
  events: GameEvent[];
}

/** `firstStep` is the `step` of the first event emitted, so SPAWN can continue a longer
 * resolution (task 13's `resolveTurn`) with `step` still strictly increasing. */
export function spawn(state: RunState, data: GameData, firstStep = 0): SpawnResult {
  const events: GameEvent[] = [];
  const nextStep = () => firstStep + events.length;

  const robots: Robot[] = state.board.robots.map((robot) => ({ ...robot }));
  const spawnCellFree = (lane: Lane) =>
    !robots.some((robot) => robot.lane === lane && robot.col === SPAWN_COL);

  for (const robot of robots) {
    if (robot.col !== null || !spawnCellFree(robot.lane)) continue;
    robot.col = SPAWN_COL;
    events.push(spawnedEvent(robot, nextStep()));
  }

  let nextIds = state.nextIds;
  const due = state.pendingSpawns.filter((entry) => entry.turn <= state.turn);
  const pendingSpawns = state.pendingSpawns.filter((entry) => entry.turn > state.turn);

  for (const entry of due) {
    const template = data.robots.find((candidate) => candidate.id === entry.robotTemplateId);
    if (!template) {
      throw new Error(`spawn: unknown robot template "${entry.robotTemplateId}"`);
    }
    const [robotId, next] = allocateRobotId(nextIds);
    nextIds = next;
    const enters = spawnCellFree(entry.lane);
    const robot: Robot = {
      robotId,
      lane: entry.lane,
      col: enters ? SPAWN_COL : null,
      hp: entry.hp,
      maxHp: entry.hp,
      trait: template.trait,
      isBoss: template.isBoss,
    };
    robots.push(robot);
    if (enters) {
      events.push(spawnedEvent(robot, nextStep()));
    } else {
      events.push({
        step: nextStep(),
        group: 'spawn',
        type: 'RobotWaiting',
        robotId,
        lane: robot.lane,
        hp: robot.hp,
        maxHp: robot.maxHp,
        trait: robot.trait,
      });
    }
  }

  return {
    state: { ...state, board: { ...state.board, robots }, pendingSpawns, nextIds },
    events,
  };
}

function spawnedEvent(robot: Robot, step: number): GameEvent {
  return {
    step,
    group: 'spawn',
    type: 'RobotSpawned',
    robotId: robot.robotId,
    at: { lane: robot.lane, col: SPAWN_COL },
    hp: robot.hp,
    maxHp: robot.maxHp,
    trait: robot.trait,
    isBoss: robot.isBoss,
  };
}
