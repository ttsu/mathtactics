// Rolls a wave into its concrete spawn schedule at wave start (GDD §10.3, TR §6
// "Rolling a wave"). Pure: takes the `wave` RNG stream and returns the advanced stream.
//
// Two shapes, never mixed (TR §9). The draw order is normative so saves and scenarios reproduce:
//
// Authored (`spawns`):
//   1. each distinct lane letter, in order of first appearance, draws one `nextInt` index into the
//      lanes still free (not fixed in this wave, not taken by an earlier letter), ascending;
//   2. each entry's HP, in file order — one draw per entry, even when `min === max`.
//
// Procedural (`procedural`): for each group in file order, on the `wave` stream only:
//   1. pick `count` distinct lanes by `nextInt` into the remaining lanes (ascending, same as
//      letter assignment);
//   2. for each drawn lane in that order: `nextInt` into the remaining pool (without replacement)
//      and `nextInt` HP in `[min, max]`.
//
// The result is stable-sorted by `turn`, so same-turn entries keep file / draw order.

import { lanes, type Lane } from '../core/coords';
import { reservedSpawnLanes } from '../core/footprint';
import { nextInt, type RngState } from '../core/rng';
import type { SpawnEntry } from '../core/types';
import type { LaneLetter, WaveDef } from '../data/schemas';

export interface RolledWave {
  spawns: SpawnEntry[];
  rng: RngState;
}

function isBossId(robotId: string, robots: readonly { id: string; isBoss: boolean }[]): boolean {
  return robots.some((robot) => robot.id === robotId && robot.isBoss);
}

function rollAuthoredWave(
  waveDef: Extract<WaveDef, { spawns: unknown }>,
  rngState: RngState,
  robots: readonly { id: string; isBoss: boolean }[],
): RolledWave {
  let rng = rngState;

  const fixedLanes = new Set<Lane>();
  for (const spawn of waveDef.spawns) {
    if (typeof spawn.lane !== 'number') continue;
    for (const lane of reservedSpawnLanes(spawn.lane, isBossId(spawn.robot, robots))) {
      fixedLanes.add(lane);
    }
  }

  const letterLanes = new Map<LaneLetter, Lane>();
  for (const spawn of waveDef.spawns) {
    if (typeof spawn.lane === 'number' || letterLanes.has(spawn.lane)) continue;
    const taken = new Set(letterLanes.values());
    const free = lanes().filter((lane) => !fixedLanes.has(lane) && !taken.has(lane));
    if (free.length === 0) {
      // The waves.json schema rejects waves with more letters than free lanes.
      throw new Error(`rollWave: no free lane for letter "${spawn.lane}" in "${waveDef.id}"`);
    }
    const [index, next] = nextInt(rng, 0, free.length - 1);
    rng = next;
    letterLanes.set(spawn.lane, free[index]!);
  }

  const spawns: SpawnEntry[] = [];
  for (const spawn of waveDef.spawns) {
    const [min, max] = spawn.hp;
    const [hp, next] = nextInt(rng, min, max);
    rng = next;
    const lane = typeof spawn.lane === 'number' ? spawn.lane : letterLanes.get(spawn.lane)!;
    spawns.push({ turn: spawn.turn, lane, robotTemplateId: spawn.robot, hp });
  }

  // `Array.prototype.sort` is stable (ES2019), so same-turn entries keep file order.
  spawns.sort((a, b) => a.turn - b.turn);
  return { spawns, rng };
}

function rollProceduralWave(
  waveDef: Extract<WaveDef, { procedural: unknown }>,
  rngState: RngState,
): RolledWave {
  let rng = rngState;
  const spawns: SpawnEntry[] = [];

  for (const group of waveDef.procedural.groups) {
    const remainingLanes = lanes();
    const drawnLanes: Lane[] = [];
    for (let i = 0; i < group.count; i += 1) {
      const [index, next] = nextInt(rng, 0, remainingLanes.length - 1);
      rng = next;
      const lane = remainingLanes.splice(index, 1)[0]!;
      drawnLanes.push(lane);
    }

    const remainingPool = [...group.pool];
    for (const lane of drawnLanes) {
      const [poolIndex, afterPool] = nextInt(rng, 0, remainingPool.length - 1);
      rng = afterPool;
      const robotTemplateId = remainingPool.splice(poolIndex, 1)[0]!;
      const [min, max] = group.hp;
      const [hp, afterHp] = nextInt(rng, min, max);
      rng = afterHp;
      spawns.push({ turn: group.turn, lane, robotTemplateId, hp });
    }
  }

  spawns.sort((a, b) => a.turn - b.turn);
  return { spawns, rng };
}

/** `robots` is the `robots.json` list so a 2×2 Boss can reserve its second lane from letter
 * assignment. Tests of non-Boss authored waves may omit it. */
export function rollWave(
  waveDef: WaveDef,
  rngState: RngState,
  robots: readonly { id: string; isBoss: boolean }[] = [],
): RolledWave {
  if ('spawns' in waveDef) {
    return rollAuthoredWave(waveDef, rngState, robots);
  }
  return rollProceduralWave(waveDef, rngState);
}
