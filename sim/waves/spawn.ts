// The SPAWN step (GDD §4 step 1, TR §6). Pure: returns a new state and the `"spawn"` events.
//
// Order: robots already waiting off-board first (in `board.robots` order — they were scheduled
// earlier), then pending entries due this turn (`turn <= state.turn`), in schedule order. Each
// enters its spawn column (7 for a 1×1, 6 for a 2×2 Boss so the back sits on 7) if every cell of
// its footprint is free (`RobotSpawned`); otherwise it waits off-board with `col: null`. Only a
// newly scheduled robot emits `RobotWaiting` — one still waiting emits nothing.

import type { Lane } from '../core/coords';
import { footprintIsFree, spawnColFor, type Occupant } from '../core/footprint';
import type { GameEvent, Robot, RunState } from '../core/types';
import type { GameData } from '../data/schemas';
import { allocateRobotId } from '../commands/ids';

/** Robots enter the board at the far right (GDD §3.1). Re-exported so callers that only need
 * the 1×1 column keep importing one name. */
export { SPAWN_COL, BOSS_SPAWN_COL, spawnColFor } from '../core/footprint';

export interface SpawnResult {
  state: RunState;
  events: GameEvent[];
}

function probe(lane: Lane, isBoss: boolean): Occupant {
  return { lane, col: spawnColFor(isBoss), isBoss };
}

/** `firstStep` is the `step` of the first event emitted, so SPAWN can continue a longer
 * resolution (task 13's `resolveTurn`) with `step` still strictly increasing. */
export function spawn(state: RunState, data: GameData, firstStep = 0): SpawnResult {
  const events: GameEvent[] = [];
  const nextStep = () => firstStep + events.length;

  const robots: Robot[] = state.board.robots.map((robot) => ({ ...robot }));
  const canEnter = (lane: Lane, isBoss: boolean) => footprintIsFree(robots, probe(lane, isBoss));

  for (const robot of robots) {
    if (robot.col !== null || !canEnter(robot.lane, robot.isBoss)) continue;
    robot.col = spawnColFor(robot.isBoss);
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
    const enters = canEnter(entry.lane, template.isBoss);
    const robot: Robot = {
      robotId,
      lane: entry.lane,
      col: enters ? spawnColFor(template.isBoss) : null,
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
  if (robot.col === null) {
    throw new Error(`spawn: RobotSpawned for off-board robot ${robot.robotId}`);
  }
  return {
    step,
    group: 'spawn',
    type: 'RobotSpawned',
    robotId: robot.robotId,
    at: { lane: robot.lane, col: robot.col },
    hp: robot.hp,
    maxHp: robot.maxHp,
    trait: robot.trait,
    isBoss: robot.isBoss,
  };
}
