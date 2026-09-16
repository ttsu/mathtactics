// Shared fixtures for `/sim/commands` tests. Not a `*.test.ts` file, so vitest's
// `include: ['tests/**/*.test.ts']` never runs it directly — it's plain test support code.

import { COLS, LANES } from '../../../sim/core/coords';
import type { GameData, LevelDef } from '../../../sim/data/schemas';
import type { RunState } from '../../../sim/core/types';
import { fakeDragSettings, fakeScreenSettings } from '../../helpers/dragSettings';
import { fakeShop } from '../../helpers/shop';
import {
  fakeDangerSettings,
  fakePacingSettings,
  fakePlaybackSettings,
} from '../../helpers/playbackSettings';

type TileDataDef = GameData['tiles'][number];

/** A blank `[lane][col]` grid (5×8), matching `Board.cells`. */
export function emptyCells(): (string | null)[][] {
  return Array.from({ length: LANES }, () => Array<string | null>(COLS).fill(null));
}

export function fakeTile(overrides: Partial<TileDataDef> = {}): TileDataDef {
  return {
    id: 'add:2',
    kind: 'add',
    n: 2,
    priceCategory: 'add',
    color: 'green',
    starred: false,
    ...overrides,
  } as TileDataDef;
}

export function fakeGameData(overrides: Partial<GameData> = {}): GameData {
  return {
    tiles: [
      fakeTile(),
      fakeTile({ id: 'add:5', n: 5 }),
      fakeTile({ id: 'mul:3', kind: 'mul', n: 3, priceCategory: 'mulLow' }),
    ],
    robots: [],
    economy: {
      schemaVersion: 1,
      baseHp: 100,
      startCoins: 0,
      startCannonLane: 2,
      startBaseValue: 1,
      maxCannons: 5,
      income: { kill: 1, exactKill: 2, waveCleared: 3 },
    },
    shop: fakeShop(),
    waves: { waves: [] },
    levels: { levels: [] },
    presentation: {
      pacing: fakePacingSettings(),
      playback: fakePlaybackSettings(),
      tileColors: { green: '#0f0', blue: '#00f', orange: '#f80' },
      drag: fakeDragSettings(),
      screens: fakeScreenSettings(),
      danger: fakeDangerSettings(),
    },
    ...overrides,
  };
}

export function fakeRunState(overrides: Partial<RunState> = {}): RunState {
  return {
    schemaVersion: 1,
    mode: 'level',
    levelId: 'test-level',
    seed: 'seed',
    rng: { wave: [1, 2, 3, 4], shop: [5, 6, 7, 8] },
    phase: 'planning',
    waveIndex: 0,
    turn: 1,
    baseHp: 100,
    coins: 0,
    cannonBaseValue: 1,
    upgradesBought: 0,
    exactKills: 0,
    pieces: {},
    tray: [],
    board: { cannons: [true, false, false, false, false], cells: emptyCells(), robots: [] },
    pendingSpawns: [],
    undo: [],
    lastTurnEvents: [],
    shop: null,
    nextIds: { robot: 0, piece: 0, ball: 0 },
    ...overrides,
  };
}

export function fakeLevelDef(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'level-1',
    cannonLanes: [0],
    baseValue: 1,
    boardTiles: [],
    tray: [],
    robots: [{ lane: 0, col: 7, hp: 1, trait: { type: 'none' } }],
    ...overrides,
  };
}

/** Deep-freezes `value` in place (and returns it) so a test can assert `applyCommand` never
 * mutates its input (task 06 requirement 5). */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}
