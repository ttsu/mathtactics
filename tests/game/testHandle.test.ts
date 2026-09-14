import { describe, expect, it } from 'vitest';
import { createTestHandle } from '../../game/state/testHandle';
import { createAppStore, stubApplyCommand } from '../../game/state/store';
import type { StorageLike } from '../../game/state/storage';
import type { GameData } from '../../sim/data/schemas';
import type { RunState } from '../../sim/core/types';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) ?? null) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function fakeGameData(): GameData {
  return {
    tiles: [],
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
    shop: {},
    waves: { waves: [] },
    levels: { levels: [] },
    presentation: {
      pacing: { ballCellDurationMs: 1, perTilePauseMs: 1, laneGapMs: 1, advanceDurationMs: 1 },
      tileColors: { green: '#0f0', blue: '#00f', orange: '#f80' },
    },
  } as unknown as GameData;
}

function fakeRunState(overrides: Partial<RunState> = {}): RunState {
  return {
    schemaVersion: 1,
    mode: 'level',
    seed: 'seed',
    rng: { wave: [1, 2, 3, 4], shop: [5, 6, 7, 8] },
    phase: 'planning',
    waveIndex: 0,
    turn: 1,
    baseHp: 100,
    coins: 0,
    cannonBaseValue: 1,
    upgradesBought: 0,
    pieces: {},
    tray: [],
    board: { cannons: [false, false, true, false, false], cells: [], robots: [] },
    pendingSpawns: [],
    undo: [],
    lastTurnEvents: [{ step: 0, group: 'fire', type: 'LaneStarted', lane: 0 }],
    shop: null,
    nextIds: { robot: 0, piece: 0, ball: 0 },
    ...overrides,
  };
}

function buildHandle() {
  const store = createAppStore({
    data: fakeGameData(),
    applyCommand: stubApplyCommand,
    storage: createMemoryStorage(),
    basePath: '/',
  });
  return { store, handle: createTestHandle(store) };
}

describe('createTestHandle', () => {
  it('getState mirrors store.run', () => {
    const { handle } = buildHandle();
    expect(handle.getState()).toBeNull();
  });

  it('getDisplay mirrors store.display', () => {
    const { handle } = buildHandle();
    expect(handle.getDisplay()).toEqual({ coins: 0, baseHp: 100, waveIndex: 0 });
  });

  it('getScreen mirrors store.screen', () => {
    const { handle } = buildHandle();
    expect(handle.getScreen()).toBe('game');
  });

  it('getEvents returns [] when there is no run', () => {
    const { handle } = buildHandle();
    expect(handle.getEvents()).toEqual([]);
  });

  it('getEvents returns run.lastTurnEvents once a run is loaded', () => {
    const { handle } = buildHandle();
    const run = fakeRunState();
    handle.loadState(run);
    expect(handle.getEvents()).toEqual(run.lastTurnEvents);
  });

  it('loadState installs the run directly and updates display', () => {
    const { handle } = buildHandle();
    const run = fakeRunState({ coins: 12, baseHp: 55, waveIndex: 4 });
    handle.loadState(run);
    expect(handle.getState()).toEqual(run);
    expect(handle.getDisplay()).toEqual({ coins: 12, baseHp: 55, waveIndex: 4 });
  });

  it('dispatch delegates to the store', () => {
    const { handle } = buildHandle();
    expect(handle.dispatch({ type: 'endTurn' })).toEqual({ ok: false, error: 'wrong_phase' });
  });

  it('isIdle is true when playback is idle', () => {
    const { handle } = buildHandle();
    expect(handle.isIdle()).toBe(true);
  });

  it('isIdle is false while playback is playing', () => {
    const { store, handle } = buildHandle();
    store.setState({ playback: { status: 'playing', events: [], cursor: 0 } });
    expect(handle.isIdle()).toBe(false);
  });

  it('endTurn throws "not implemented yet (task 7)"', () => {
    const { handle } = buildHandle();
    expect(() => handle.endTurn()).toThrow('not implemented yet (task 7)');
  });

  it('loadScenario throws "not implemented yet (task 8)"', () => {
    const { handle } = buildHandle();
    expect(() => handle.loadScenario('')).toThrow('not implemented yet (task 8)');
  });

  it('cellToClient throws "not implemented yet (task 9)"', () => {
    const { handle } = buildHandle();
    expect(() => handle.cellToClient({ lane: 0, col: 0 })).toThrow('not implemented yet (task 9)');
  });

  it('skipAnimation throws "not implemented yet (task 10)"', () => {
    const { handle } = buildHandle();
    expect(() => handle.skipAnimation()).toThrow('not implemented yet (task 10)');
  });
});
