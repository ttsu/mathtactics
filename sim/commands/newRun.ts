// Builds a fresh run (GDD §10.1, TR §5 `newRun`). Pure: the seed is chosen at the edge
// (`/game/state`), never here. Starts wave 0 — rolls it and runs its turn-1 SPAWN — so the
// player's first planning phase already shows the wave's first robots.

import { cols, lanes } from '../core/coords';
import { createStreams } from '../core/rng';
import type { GameEvent, RunState } from '../core/types';
import type { GameData } from '../data/schemas';
import { rollWave } from '../waves/rollWave';
import { spawn } from '../waves/spawn';

export function buildNewRun(
  seed: string,
  data: GameData,
): { state: RunState; events: GameEvent[] } {
  const { economy } = data;
  const firstWave = data.waves.waves[0];
  if (!firstWave) {
    throw new Error('newRun: waves.json has no waves');
  }

  // `createStreams` seeds `wave` and `shop` from different derived strings, so they differ.
  const streams = createStreams(seed);
  const rolled = rollWave(firstWave, streams.wave, data.robots);

  const state: RunState = {
    schemaVersion: economy.schemaVersion,
    mode: 'run',
    seed,
    rng: { wave: rolled.rng, shop: streams.shop },
    phase: 'planning',
    waveIndex: 0,
    turn: 1,
    baseHp: economy.baseHp,
    coins: economy.startCoins,
    cannonBaseValue: economy.startBaseValue,
    upgradesBought: 0,
    exactKills: 0,
    pieces: {},
    tray: [],
    board: {
      cannons: lanes().map((lane) => lane === economy.startCannonLane),
      cells: lanes().map(() => cols().map(() => null)),
      robots: [],
    },
    pendingSpawns: rolled.spawns,
    undo: [],
    lastTurnEvents: [],
    shop: null,
    nextIds: { robot: 0, piece: 0, ball: 0 },
  };

  return spawn(state, data);
}
