import { describe, expect, it, vi } from 'vitest';
import { createTestHandle } from '../../game/state/testHandle';
import { createAppStore, displayFromRun, stubApplyCommand } from '../../game/state/store';
import type { ApplyCommandFn } from '../../game/state/store';
import type { StorageLike } from '../../game/state/storage';
import type { GameData } from '../../sim/data/schemas';
import type { GameEvent, RunState } from '../../sim/core/types';
import { fakeDragSettings, fakeScreenSettings } from '../helpers/dragSettings';
import { fakeShop } from '../helpers/shop';
import {
  fakePacingSettings,
  fakePlaybackSettings,
  fakeHudSettings,
  fakeHintsSettings,
} from '../helpers/playbackSettings';

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
    shop: fakeShop(),
    waves: { waves: [] },
    levels: { levels: [] },
    presentation: {
      pacing: fakePacingSettings(),
      playback: fakePlaybackSettings(),
      tileColors: { green: '#0f0', blue: '#00f', orange: '#f80' },
      drag: fakeDragSettings(),
      screens: fakeScreenSettings(),
      hud: fakeHudSettings(),
      hints: fakeHintsSettings(),
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
    exactKills: 0,
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

  it('getScreen mirrors store.screen (the app opens on the menu, task 11)', () => {
    const { store, handle } = buildHandle();
    expect(handle.getScreen()).toBe('menu');
    store.getState().setScreen('allDone');
    expect(handle.getScreen()).toBe('allDone');
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

  it('loadState and loadScenario bypass the menu and show the game screen (task 11)', () => {
    const { store, handle } = buildHandle();
    handle.loadState(fakeRunState());
    expect(handle.getScreen()).toBe('game');

    store.getState().setScreen('menu');
    handle.loadScenario(
      ['name: t', 'baseValue: 1', 'board:', ...Array(5).fill('  - ". . . . . . . ."')].join('\n'),
    );
    expect(handle.getScreen()).toBe('game');
  });

  it('loadScenario with phase shop lands on the shop screen', () => {
    const { handle } = buildHandle();
    handle.loadScenario(
      [
        'name: t',
        'mode: run',
        'phase: shop',
        'baseValue: 1',
        'coins: 0',
        'board:',
        ...Array(5).fill('  - ". . . . . . . ."'),
        'shop:',
        '  - { slot: "tile:0", kind: tile, tileId: "add:5", price: 4, bought: false }',
        '  - { slot: cannon, kind: cannon, price: 10, bought: false, available: true }',
        '  - { slot: upgrade, kind: upgrade, price: 12, bought: false, fromValue: 1, toValue: 2 }',
      ].join('\n'),
    );
    expect(handle.getScreen()).toBe('shop');
    expect(handle.getState()?.phase).toBe('shop');
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

  it('loadState never touches storage or savedRun (task 14 req. 6, TR §14)', () => {
    const storage = createMemoryStorage();
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage,
      basePath: '/',
    });
    const handle = createTestHandle(store);

    handle.loadState(fakeRunState({ mode: 'run', coins: 42 }));

    expect(store.getState().run?.coins).toBe(42);
    expect(storage.getItem('mt:/:run')).toBeNull();
    expect(store.getState().savedRun).toBeNull();
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

  it('loadScenario with waves: runs the session on those waves; loadState restores the shipped ones', () => {
    const { store, handle } = buildHandle();
    const shipped = store.getState().data;
    const yamlText = [
      'name: scenario waves',
      'mode: run',
      'baseValue: 1',
      'board:',
      ...Array(5).fill('  - ". . . . . . . ."'),
      'waves:',
      '  - id: first',
      '    spawns:',
      '      - { turn: 1, lane: 0, robot: basic, hp: [2, 2] }',
      '  - id: second',
      '    spawns:',
      '      - { turn: 1, lane: 1, robot: basic, hp: [3, 3] }',
    ].join('\n');

    handle.loadScenario(yamlText);
    const data = store.getState().data;
    expect(data.waves.waves.map((wave) => wave.id)).toEqual(['first', 'second']);
    // Only `waves` is swapped; everything else is still the shipped data.
    expect({ ...data, waves: shipped.waves }).toEqual(shipped);

    handle.loadState(fakeRunState());
    expect(store.getState().data).toBe(shipped);
  });

  it('cellToClient delegates to the mounted board', () => {
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage: createMemoryStorage(),
      basePath: '/',
    });
    const drawn = { robots: [{ robotId: 'robot:0', x: 5, y: 6 }], tiles: ['piece:1'] };
    const handle = createTestHandle(store, {
      cellToClient: (cell) => ({ x: cell.col * 10, y: cell.lane * 10 }),
      skipAnimation: () => {},
      isAnimating: () => false,
      renderedBoard: () => drawn,
      getHints: () => [{ lane: 2, col: 1, value: 5 }],
    });
    expect(handle.cellToClient({ lane: 2, col: 3 })).toEqual({ x: 30, y: 20 });
    expect(handle.renderedBoard()).toBe(drawn);
    expect(handle.getHints()).toEqual([{ lane: 2, col: 1, value: 5 }]);
  });

  it('cellToClient, renderedBoard and getHints throw when no board is mounted', () => {
    const { handle } = buildHandle();
    expect(() => handle.cellToClient({ lane: 0, col: 0 })).toThrow('no board mounted');
    expect(() => handle.renderedBoard()).toThrow('no board mounted');
    expect(() => handle.getHints()).toThrow('no board mounted');
  });

  it('skipAnimation without a board finishes playback directly', () => {
    const { store, handle } = buildHandle();
    const run = fakeRunState({ coins: 12 });
    handle.loadState(run);
    store.setState({
      display: { coins: 0, baseHp: 0, waveIndex: 0 },
      playback: { status: 'playing', events: [], cursor: 0 },
    });

    handle.skipAnimation();

    expect(handle.isIdle()).toBe(true);
    expect(handle.getDisplay()).toEqual(displayFromRun(run));
  });

  it('skipAnimation asks the mounted board to finish its sequence', () => {
    const { store } = buildHandle();
    store.setState({ playback: { status: 'playing', events: [], cursor: 0 } });
    const board = {
      cellToClient: () => ({ x: 0, y: 0 }),
      // The Director finishes by calling finishPlayback itself.
      skipAnimation: vi.fn(() => store.getState().finishPlayback()),
      isAnimating: () => false,
      renderedBoard: () => ({ robots: [], tiles: [] }),
      getHints: () => [],
    };
    const handle = createTestHandle(store, board);

    handle.skipAnimation();

    expect(board.skipAnimation).toHaveBeenCalledTimes(1);
    expect(handle.isIdle()).toBe(true);
  });

  it('isIdle is false while the board still has tweens or timers pending', () => {
    const { store } = buildHandle();
    let animating = true;
    const handle = createTestHandle(store, {
      cellToClient: () => ({ x: 0, y: 0 }),
      skipAnimation: () => {},
      isAnimating: () => animating,
      renderedBoard: () => ({ robots: [], tiles: [] }),
      getHints: () => [],
    });
    expect(store.getState().playback.status).toBe('idle');
    expect(handle.isIdle()).toBe(false);
    animating = false;
    expect(handle.isIdle()).toBe(true);
  });

  it('loadState drops any replay snapshot', () => {
    const { store, handle } = buildHandle();
    store.setState({ lastTurn: { before: fakeRunState(), events: [] } });
    handle.loadState(fakeRunState());
    expect(store.getState().lastTurn).toBeNull();
  });
});
