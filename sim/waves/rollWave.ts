// Rolls an authored wave into its concrete spawn schedule at wave start (GDD §10.3, TR §6
// "Rolling a wave"). Pure: takes the `wave` RNG stream and returns the advanced stream.
//
// The draw order is normative so saves and scenarios reproduce exactly:
//   1. each distinct lane letter, in order of first appearance, draws one `nextInt` index into the
//      lanes still free (not fixed in this wave, not taken by an earlier letter), ascending;
//   2. each entry's HP, in file order — one draw per entry, even when `min === max`.
// The result is stable-sorted by `turn`, so same-turn entries keep file order.

import { lanes, type Lane } from '../core/coords';
import { nextInt, type RngState } from '../core/rng';
import type { SpawnEntry } from '../core/types';
import type { LaneLetter, WaveDef } from '../data/schemas';

export interface RolledWave {
  spawns: SpawnEntry[];
  rng: RngState;
}

export function rollWave(waveDef: WaveDef, rngState: RngState): RolledWave {
  let rng = rngState;

  const fixedLanes = new Set<Lane>();
  for (const spawn of waveDef.spawns) {
    if (typeof spawn.lane === 'number') fixedLanes.add(spawn.lane);
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
