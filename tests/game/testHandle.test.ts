import { describe, expect, it } from 'vitest';
import { createTestHandle } from '../../game/state/testHandle';
import { createAppStore, stubApplyCommand } from '../../game/state/store';
import type { ApplyCommandFn } from '../../game/state/store';
import type { StorageLike } from '../../game/state/storage';
import type { GameData } from '../../sim/data/schemas';
import type { GameEvent, RunState } from '../../sim/core/types';
import { fakeDragSettings } from '../helpers/dragSettings';

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
      drag: fakeDragSettings(),
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

function buildHandle(applyCommand = stubApplyCommand) {
  const store = createAppStore({
    data: fakeGameData(),
    applyCommand,
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

  it('loadState resets playback to idle (finding 8, final review)', () => {
    const { store, handle } = buildHandle();
    store.setState({
      playback: {
        status: 'playing',
        events: [{ step: 0, group: 'fire', type: 'LaneStarted', lane: 0 }],
        cursor: 1,
      },
    });
    expect(handle.isIdle()).toBe(false);

    handle.loadState(fakeRunState());

    expect(handle.isIdle()).toBe(true);
    expect(store.getState().playback).toEqual({ status: 'idle', events: [], cursor: 0 });
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

  it('endTurn returns [] when the dispatch fails (task 07 ruling)', () => {
    const { handle } = buildHandle();
    expect(handle.endTurn()).toEqual([]);
  });

  it("endTurn dispatches endTurn and returns the resolved run's lastTurnEvents", () => {
    const events: GameEvent[] = [{ step: 0, group: 'fire:lane:0', type: 'LaneStarted', lane: 0 }];
    const resolvedRun = fakeRunState({ lastTurnEvents: events });
    const fakeApplyCommand: ApplyCommandFn = (state, cmd) => {
      if (cmd.type !== 'endTurn') return { ok: false, error: 'wrong_phase' };
      return { ok: true, state: resolvedRun, events };
    };
    const { handle } = buildHandle(fakeApplyCommand);
    expect(handle.endTurn()).toEqual(events);
  });

  it('loadScenario installs the scenario’s initial state', () => {
    const { handle } = buildHandle();
    const yamlText = [
      'name: test scenario',
      'baseValue: 1',
      'board:',
      '  - "C . . . . . . ."',
      '  - ". . . . . . . ."',
      '  - ". . . . . . . R5"',
      '  - ". . . . . . . ."',
      '  - ". . . . . . . ."',
    ].join('\n');

    handle.loadScenario(yamlText);

    const state = handle.getState();
    expect(state).not.toBeNull();
    expect(state?.phase).toBe('planning');
    expect(state?.levelId).toBe('scenario:test-scenario');
    expect(state?.board.cannons).toEqual([true, false, false, false, false]);
    expect(state?.board.robots).toEqual([
      {
        robotId: state?.board.robots[0]?.robotId,
        lane: 2,
        col: 7,
        hp: 5,
        maxHp: 5,
        trait: { type: 'none' },
        isBoss: false,
      },
    ]);
  });

  it('cellToClient delegates to the mounted board', () => {
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage: createMemoryStorage(),
      basePath: '/',
    });
    const handle = createTestHandle(store, {
      cellToClient: (cell) => ({ x: cell.col * 10, y: cell.lane * 10 }),
    });
    expect(handle.cellToClient({ lane: 2, col: 3 })).toEqual({ x: 30, y: 20 });
  });

  it('cellToClient throws when no board is mounted', () => {
    const { handle } = buildHandle();
    expect(() => handle.cellToClient({ lane: 0, col: 0 })).toThrow('no board mounted');
  });

  it('skipAnimation throws "not implemented yet (task 10)"', () => {
    const { handle } = buildHandle();
    expect(() => handle.skipAnimation()).toThrow('not implemented yet (task 10)');
  });
});
