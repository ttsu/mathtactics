// `nextWave` (GDD §4 step 5, §8.3, TR §5/§6): leaves the shop and starts the next wave.
// Pure, mirrors `newRun.ts`'s shape but carries the run forward instead of building one from
// scratch — board tiles, tray, cannons, coins, base HP, `cannonBaseValue`, `upgradesBought`,
// and `exactKills` all carry over unchanged. Unbought offers vanish with `shop: null`.
//
// `applyCommand` (TR §5) checks the `shop` phase guard before calling this.

import type { GameEvent, RunState } from '../core/types';
import type { GameData } from '../data/schemas';
import { waveForRun } from '../waves/applyDifficulty';
import { rollWave } from '../waves/rollWave';
import { spawn } from '../waves/spawn';

export function buildNextWave(
  state: RunState,
  data: GameData,
): { state: RunState; events: GameEvent[] } {
  const waveIndex = state.waveIndex + 1;
  const waveDef = waveForRun(data, waveIndex, state.difficulty);
  const rolled = rollWave(waveDef, state.rng.wave, data.robots);

  const nextState: RunState = {
    ...state,
    waveIndex,
    turn: 1,
    rng: { ...state.rng, wave: rolled.rng },
    phase: 'planning',
    pendingSpawns: rolled.spawns,
    undo: [],
    lastTurnEvents: [],
    shop: null,
  };

  return spawn(nextState, data);
}
