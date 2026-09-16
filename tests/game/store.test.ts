import { describe, expect, it, vi } from 'vitest';
import { applyCommand } from '../../sim/commands';
import {
  canReplay,
  createAppStore,
  isPlaybackActive,
  displayFromRun,
  sequenceStart,
  stubApplyCommand,
  type ApplyCommandFn,
  type Playback,
} from '../../game/state/store';
import { scopedKey, type StorageLike } from '../../game/state/storage';
import type { GameData } from '../../sim/data/schemas';
import type { GameEvent, RunState } from '../../sim/core/types';
import { fakeDragSettings, fakeScreenSettings } from '../helpers/dragSettings';
import { fakeShop } from '../helpers/shop';
import { boardState, realData } from './boardFixtures';
import { fakePacingSettings, fakePlaybackSettings } from '../helpers/playbackSettings';

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

function fakeGameData(overrides: Partial<GameData['economy']> = {}): GameData {
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
      ...overrides,
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
    waveIndex: 2,
    turn: 1,
    baseHp: 42,
    coins: 9,
    cannonBaseValue: 1,
    upgradesBought: 0,
    exactKills: 0,
    pieces: {},
    tray: [],
    board: { cannons: [false, false, true, false, false], cells: [], robots: [] },
    pendingSpawns: [],
    undo: [],
    lastTurnEvents: [],
    shop: null,
    nextIds: { robot: 0, piece: 0, ball: 0 },
    ...overrides,
  };
}

describe('createAppStore — initial state', () => {
  it('derives display from data.economy when no run is saved', () => {
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage: createMemoryStorage(),
      basePath: '/',
    });
    expect(store.getState().run).toBeNull();
    expect(store.getState().savedRun).toBeNull();
    expect(store.getState().display).toEqual({ coins: 0, baseHp: 100, waveIndex: 0 });
  });

  it('loads a previously-saved run and derives display from it', () => {
    const storage = createMemoryStorage();
    const savedRun = fakeRunState();
    storage.setItem(
      scopedKey('/', 'run'),
      JSON.stringify({ schemaVersion: 1, savedAt: 1, state: savedRun }),
    );
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage,
      basePath: '/',
    });
    expect(store.getState().run).toEqual(savedRun);
    expect(store.getState().savedRun).toEqual(savedRun);
    expect(store.getState().display).toEqual(displayFromRun(savedRun));
  });

  it('clears a won/lost saved run on boot and treats it as not resumable (task 14 req. 2)', () => {
    for (const phase of ['won', 'lost'] as const) {
      const storage = createMemoryStorage();
      const finished = fakeRunState({ mode: 'run', phase });
      storage.setItem(
        scopedKey('/', 'run'),
        JSON.stringify({ schemaVersion: 1, savedAt: 1, state: finished }),
      );
      const store = createAppStore({
        data: fakeGameData(),
        applyCommand: stubApplyCommand,
        storage,
        basePath: '/',
      });
      expect(store.getState().run).toBeNull();
      expect(store.getState().savedRun).toBeNull();
      expect(storage.getItem(scopedKey('/', 'run'))).toBeNull();
    }
  });

  it('starts with idle playback and default settings', () => {
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage: createMemoryStorage(),
      basePath: '/',
    });
    expect(store.getState().playback).toEqual({ status: 'idle', events: [], cursor: 0 });
    expect(store.getState().settings).toEqual({ hints: false, sound: true });
  });
});

describe('dispatch', () => {
  it('calls applyCommand with a null state when no run exists yet, and does not persist on failure', () => {
    const data = fakeGameData();
    const applyCommand = vi.fn<ApplyCommandFn>(() => ({ ok: false, error: 'wrong_phase' }));
    const storage = createMemoryStorage();
    const store = createAppStore({ data, applyCommand, storage, basePath: '/' });

    const result = store.getState().dispatch({ type: 'endTurn' });

    expect(result).toEqual({ ok: false, error: 'wrong_phase' });
    expect(applyCommand).toHaveBeenCalledWith(null, { type: 'endTurn' }, data);
    expect(storage.getItem(scopedKey('/', 'run'))).toBeNull();
  });

  it('bootstraps a run from a null state on newRun/loadLevel success (finding 1, final review)', () => {
    const storage = createMemoryStorage();
    const bootstrapped = fakeRunState({ coins: 3, mode: 'run' });
    const applyCommand: ApplyCommandFn = (state) => {
      if (state !== null) {
        throw new Error('expected applyCommand to receive a null state for a fresh boot');
      }
      return { ok: true, state: bootstrapped, events: [] };
    };
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand,
      storage,
      basePath: '/',
      now: () => 777,
    });

    const result = store.getState().dispatch({ type: 'newRun', seed: 'abc' });

    expect(result).toEqual({ ok: true });
    expect(store.getState().run).toEqual(bootstrapped);
    expect(store.getState().savedRun).toEqual(bootstrapped);
    expect(store.getState().display).toEqual(displayFromRun(bootstrapped));
    const saved = JSON.parse(storage.getItem(scopedKey('/', 'run')) ?? 'null');
    expect(saved).toEqual({ schemaVersion: 1, savedAt: 777, state: bootstrapped });
  });

  it('does not persist on a failing command', () => {
    const storage = createMemoryStorage();
    const run = fakeRunState();
    storage.setItem(
      scopedKey('/', 'run'),
      JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
    );
    const applyCommand: ApplyCommandFn = () => ({ ok: false, error: 'nothing_to_undo' });
    const store = createAppStore({ data: fakeGameData(), applyCommand, storage, basePath: '/' });

    const before = storage.getItem(scopedKey('/', 'run'));
    const result = store.getState().dispatch({ type: 'undo' });

    expect(result).toEqual({ ok: false, error: 'nothing_to_undo' });
    expect(storage.getItem(scopedKey('/', 'run'))).toBe(before);
    expect(store.getState().run).toEqual(run);
  });

  it('persists the new run and updates state on success', () => {
    const storage = createMemoryStorage();
    const run = fakeRunState({ mode: 'run' });
    storage.setItem(
      scopedKey('/', 'run'),
      JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
    );
    const nextRun = fakeRunState({ coins: 99, mode: 'run' });
    const applyCommand: ApplyCommandFn = () => ({ ok: true, state: nextRun, events: [] });
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand,
      storage,
      basePath: '/',
      now: () => 555,
    });

    const result = store.getState().dispatch({ type: 'endTurn' });

    expect(result).toEqual({ ok: true });
    expect(store.getState().run).toEqual(nextRun);
    expect(store.getState().savedRun).toEqual(nextRun);
    expect(store.getState().display).toEqual(displayFromRun(nextRun));
    const saved = JSON.parse(storage.getItem(scopedKey('/', 'run')) ?? 'null');
    expect(saved).toEqual({ schemaVersion: 1, savedAt: 555, state: nextRun });
  });

  it('sets playback to playing with the returned events when resolution produced events', () => {
    const storage = createMemoryStorage();
    const run = fakeRunState();
    storage.setItem(
      scopedKey('/', 'run'),
      JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
    );
    const events = [{ step: 0, group: 'fire:lane:2', type: 'LaneStarted', lane: 2 }] as const;
    const applyCommand: ApplyCommandFn = () => ({
      ok: true,
      state: fakeRunState({ coins: 1 }),
      events: [...events],
    });
    const store = createAppStore({ data: fakeGameData(), applyCommand, storage, basePath: '/' });

    store.getState().dispatch({ type: 'endTurn' });

    expect(store.getState().playback).toEqual({
      status: 'playing',
      events: [...events],
      cursor: 0,
      // A normal turn's board starts from the run as it was before it.
      before: run,
    });
  });

  it('leaves playback untouched but refreshes display when resolution produced no events (finding 2, final review)', () => {
    const storage = createMemoryStorage();
    const run = fakeRunState();
    storage.setItem(
      scopedKey('/', 'run'),
      JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
    );
    const nextRun = fakeRunState({ coins: 42, baseHp: 7, waveIndex: 5 });
    const applyCommand: ApplyCommandFn = () => ({ ok: true, state: nextRun, events: [] });
    const store = createAppStore({ data: fakeGameData(), applyCommand, storage, basePath: '/' });

    store.getState().dispatch({ type: 'placeTile', pieceId: 'p1', to: { lane: 0, col: 1 } });

    expect(store.getState().playback).toEqual({ status: 'idle', events: [], cursor: 0 });
    expect(store.getState().display).toEqual(displayFromRun(nextRun));
  });

  it('does not overwrite display while playback is already playing, even with a no-event command', () => {
    const storage = createMemoryStorage();
    const run = fakeRunState();
    storage.setItem(
      scopedKey('/', 'run'),
      JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
    );
    const applyCommand: ApplyCommandFn = () => ({
      ok: true,
      state: fakeRunState({ coins: 500 }),
      events: [],
    });
    const store = createAppStore({ data: fakeGameData(), applyCommand, storage, basePath: '/' });
    const stalePlayback: Playback = {
      status: 'playing',
      events: [{ step: 0, group: 'fire', type: 'LaneStarted', lane: 0 }],
      cursor: 0,
    };
    const staleDisplay = { coins: 1, baseHp: 1, waveIndex: 1 };
    store.setState({ playback: stalePlayback, display: staleDisplay });

    store.getState().dispatch({ type: 'placeTile', pieceId: 'p1', to: { lane: 0, col: 1 } });

    expect(store.getState().display).toEqual(staleDisplay);
  });

  describe('persistence scoping (task 14 req. 1)', () => {
    it('never writes to storage for a level-mode result — a Puzzle can never overwrite a saved run', () => {
      const storage = createMemoryStorage();
      const savedRun = fakeRunState({ mode: 'run', coins: 7 });
      storage.setItem(
        scopedKey('/', 'run'),
        JSON.stringify({ schemaVersion: 1, savedAt: 1, state: savedRun }),
      );
      const levelResult = fakeRunState({ mode: 'level', coins: 0 });
      // Stands in for `loadLevel`: applyCommand succeeds with a fresh level-mode state.
      const applyCommand: ApplyCommandFn = () => ({ ok: true, state: levelResult, events: [] });
      const store = createAppStore({ data: fakeGameData(), applyCommand, storage, basePath: '/' });

      store.getState().dispatch({ type: 'loadLevel', levelId: 'level-1' });

      expect(store.getState().run).toEqual(levelResult);
      // Storage — and the in-memory mirror of it — are untouched: still the saved run.
      const stillSaved = JSON.parse(storage.getItem(scopedKey('/', 'run')) ?? 'null');
      expect(stillSaved).toEqual({ schemaVersion: 1, savedAt: 1, state: savedRun });
      expect(store.getState().savedRun).toEqual(savedRun);
    });

    it('never removes a saved run for a level-mode result either (no save existed)', () => {
      const storage = createMemoryStorage();
      const applyCommand: ApplyCommandFn = () => ({
        ok: true,
        state: fakeRunState({ mode: 'level' }),
        events: [],
      });
      const store = createAppStore({ data: fakeGameData(), applyCommand, storage, basePath: '/' });

      store.getState().dispatch({ type: 'loadLevel', levelId: 'level-1' });

      expect(storage.getItem(scopedKey('/', 'run'))).toBeNull();
      expect(store.getState().savedRun).toBeNull();
    });
  });

  describe('lastTurn stays off for a fresh phase (task 14 req. 2)', () => {
    it('does not set a Replay snapshot for newRun, even though a run already existed', () => {
      const storage = createMemoryStorage();
      const previousRun = fakeRunState({ mode: 'level' }); // e.g. a Puzzle played this session
      const freshRun = fakeRunState({ mode: 'run', coins: 0 });
      const events: GameEvent[] = [{ step: 0, group: 'spawn', type: 'LaneStarted', lane: 0 }];
      const applyCommand: ApplyCommandFn = () => ({ ok: true, state: freshRun, events });
      const store = createAppStore({ data: fakeGameData(), applyCommand, storage, basePath: '/' });
      store.setState({ run: previousRun });

      store.getState().dispatch({ type: 'newRun', seed: 'abc' });

      expect(store.getState().playback.status).toBe('playing');
      expect(store.getState().lastTurn).toBeNull();
    });

    it('does not set a Replay snapshot for nextWave, even though it continues the same run', () => {
      const storage = createMemoryStorage();
      const beforeWave = fakeRunState({ mode: 'run', phase: 'waveCleared' });
      const afterWave = fakeRunState({ mode: 'run', phase: 'planning', waveIndex: 1 });
      const events: GameEvent[] = [{ step: 0, group: 'spawn', type: 'LaneStarted', lane: 0 }];
      const applyCommand: ApplyCommandFn = () => ({ ok: true, state: afterWave, events });
      const store = createAppStore({ data: fakeGameData(), applyCommand, storage, basePath: '/' });
      store.setState({ run: beforeWave });

      store.getState().dispatch({ type: 'nextWave' });

      expect(store.getState().lastTurn).toBeNull();
    });
  });

  describe('display on a fresh phase (New Run must not show the previous run’s ♥/🪙)', () => {
    function startedRunStore() {
      const storage = createMemoryStorage();
      const store = createAppStore({ data: realData, applyCommand, storage, basePath: '/' });
      store.getState().dispatch({ type: 'newRun', seed: 'earlier' });
      store.getState().finishPlayback();
      return store;
    }

    it('newRun from a lost run shows the new run’s ♥ and 🪙 at once, not after playback', () => {
      const store = startedRunStore();
      const lostRun: RunState = { ...store.getState().run!, phase: 'lost', baseHp: -7, coins: 23 };
      store.setState({ run: lostRun, display: displayFromRun(lostRun), screen: 'lost' });
      expect(store.getState().display.coins).toBe(23);

      store.getState().dispatch({ type: 'newRun', seed: 'fresh' });

      const { run, display, playback } = store.getState();
      // The spawn events are still to play — and carry no HUD events — yet the HUD already
      // reads the new run, not the lost one.
      expect(playback.status).toBe('playing');
      expect(run?.phase).toBe('planning');
      expect(display).toEqual(displayFromRun(run!));
      expect(display).toMatchObject({
        baseHp: realData.economy.baseHp,
        coins: realData.economy.startCoins,
      });
    });

    it('nextWave keeps ♥ and 🪙 (they carry over) while its spawns play', () => {
      const store = startedRunStore();
      const started = store.getState().run!;
      const waveCleared: RunState = {
        ...started,
        phase: 'waveCleared',
        board: { ...started.board, robots: [] },
        pendingSpawns: [],
        baseHp: 61,
        coins: 9,
      };
      store.setState({ run: waveCleared, display: displayFromRun(waveCleared) });

      store.getState().dispatch({ type: 'openShop' });
      store.getState().dispatch({ type: 'nextWave' });

      expect(store.getState().playback.status).toBe('playing');
      expect(store.getState().display).toEqual({ baseHp: 61, coins: 9, waveIndex: 1 });
    });
  });

  describe('playback.before — where the board starts a sequence (New Run over an old board)', () => {
    const puzzleRows = [
      '. . . . . . . .',
      'C +2 R5 . . . . .',
      '. . . . R3 . . .',
      '. . . . . . . .',
      '. . . . . . . .',
    ];

    it('newRun over a puzzle starts from the new run with none of the old robots or tiles', () => {
      const store = createAppStore({
        data: realData,
        applyCommand,
        storage: createMemoryStorage(),
        basePath: '/',
      });
      const puzzle = boardState(puzzleRows, ['mul:2', 'add:5']);
      store.setState({ run: puzzle, display: displayFromRun(puzzle) });
      // The old board really has a `robot:0` — the id the new run's first robot reuses.
      expect(puzzle.board.robots.map((robot) => robot.robotId)).toContain('robot:0');

      store.getState().dispatch({ type: 'newRun', seed: 'over-a-puzzle' });

      const { run, playback } = store.getState();
      const before = playback.before!;
      expect(playback.events.some((event) => event.type === 'RobotSpawned')).toBe(true);
      // Empty wave start: no robots at all (so no leftover `robot:0` for the spawn to slide from),
      // and the new run's own (empty) tiles, tray and cannons — nothing from the puzzle.
      expect(before.board.robots).toEqual([]);
      expect(before.board.cells).toEqual(run!.board.cells);
      expect(before.board.cannons).toEqual(run!.board.cannons);
      expect(before.tray).toEqual(run!.tray);
      expect(before.pieces).toEqual(run!.pieces);
      expect(before.mode).toBe('run');
      expect(before).not.toBe(puzzle);
    });

    it('nextWave starts from exactly the wave-cleared board (verified, not assumed)', () => {
      const store = createAppStore({
        data: realData,
        applyCommand,
        storage: createMemoryStorage(),
        basePath: '/',
      });
      store.getState().dispatch({ type: 'newRun', seed: 'next-wave-start' });
      store.getState().finishPlayback();
      // Clear wave 1 for real: no robots left and nothing pending, then End Turn.
      const started = store.getState().run!;
      const lastTurnOfWave: RunState = {
        ...started,
        board: { ...started.board, robots: [] },
        pendingSpawns: [],
      };
      store.setState({ run: lastTurnOfWave });
      store.getState().dispatch({ type: 'endTurn' });
      store.getState().finishPlayback();
      const waveCleared = store.getState().run!;
      expect(waveCleared.phase).toBe('waveCleared');

      store.getState().dispatch({ type: 'openShop' });
      store.getState().dispatch({ type: 'nextWave' });

      const { run, playback } = store.getState();
      const before = playback.before!;
      expect(playback.status).toBe('playing');
      expect(before.board).toEqual(waveCleared.board);
      expect(before.tray).toEqual(waveCleared.tray);
      expect(before.pieces).toEqual(waveCleared.pieces);
      // …while the run itself already holds the new wave's robots.
      expect(run!.board.robots.length).toBeGreaterThan(0);
    });

    it('sequenceStart keeps waiting robots out too, and a normal turn starts from the previous run', () => {
      const previous = boardState(puzzleRows);
      const next: RunState = {
        ...previous,
        board: {
          ...previous.board,
          robots: [
            ...previous.board.robots,
            {
              robotId: 'robot:8',
              lane: 4,
              col: 7,
              hp: 2,
              maxHp: 2,
              trait: { type: 'none' },
              isBoss: false,
            },
            {
              robotId: 'robot:9',
              lane: 4,
              col: null,
              hp: 3,
              maxHp: 3,
              trait: { type: 'none' },
              isBoss: false,
            },
          ],
        },
      };
      const events: GameEvent[] = [
        {
          step: 0,
          group: 'spawn',
          type: 'RobotSpawned',
          robotId: 'robot:8',
          at: { lane: 4, col: 7 },
          hp: 2,
          maxHp: 2,
          trait: { type: 'none' },
          isBoss: false,
        },
        {
          step: 1,
          group: 'spawn',
          type: 'RobotWaiting',
          robotId: 'robot:9',
          lane: 4,
          hp: 3,
          maxHp: 3,
          trait: { type: 'none' },
        },
      ];

      expect(sequenceStart(previous, next, events, true)!.board.robots).toEqual(
        previous.board.robots,
      );
      expect(sequenceStart(previous, next, events, false)).toBe(previous);
      expect(sequenceStart(null, next, events, false)).toBeUndefined();
    });
  });
});

describe('commitEvent', () => {
  it('updates display.coins on CoinsChanged and never touches run', () => {
    const storage = createMemoryStorage();
    const run = fakeRunState({ coins: 9 });
    storage.setItem(
      scopedKey('/', 'run'),
      JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
    );
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage,
      basePath: '/',
    });

    store.getState().commitEvent({
      step: 0,
      group: 'fire',
      type: 'CoinsChanged',
      delta: 2,
      total: 11,
      reason: 'kill',
    });

    expect(store.getState().display.coins).toBe(11);
    expect(store.getState().run).toEqual(run);
  });

  it('updates display.baseHp on BaseDamaged', () => {
    const storage = createMemoryStorage();
    const run = fakeRunState({ baseHp: 42 });
    storage.setItem(
      scopedKey('/', 'run'),
      JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
    );
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage,
      basePath: '/',
    });

    store.getState().commitEvent({
      step: 0,
      group: 'detonate:2',
      type: 'BaseDamaged',
      amount: 10,
      hpBefore: 42,
      hpAfter: 32,
    });

    expect(store.getState().display.baseHp).toBe(32);
  });

  it('clamps display.baseHp at 0 for a negative BaseDamaged hpAfter (task 15 req. 3)', () => {
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage: createMemoryStorage(),
      basePath: '/',
    });

    store.getState().commitEvent({
      step: 0,
      group: 'detonate:2',
      type: 'BaseDamaged',
      amount: 30,
      hpBefore: 10,
      hpAfter: -20,
    });

    expect(store.getState().display.baseHp).toBe(0);
  });

  it('is a no-op for other event types', () => {
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage: createMemoryStorage(),
      basePath: '/',
    });
    const before = store.getState().display;

    store.getState().commitEvent({ step: 0, group: 'advance', type: 'LaneStarted', lane: 0 });

    expect(store.getState().display).toEqual(before);
  });
});

describe('finishPlayback', () => {
  it('derives display from run and resets playback to idle', () => {
    const storage = createMemoryStorage();
    const run = fakeRunState({ coins: 5, baseHp: 80, waveIndex: 3 });
    storage.setItem(
      scopedKey('/', 'run'),
      JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
    );
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage,
      basePath: '/',
    });
    store.setState({
      display: { coins: 0, baseHp: 0, waveIndex: 0 },
      playback: {
        status: 'playing',
        events: [{ step: 0, group: 'fire', type: 'LaneStarted', lane: 0 }],
        cursor: 1,
      },
    });

    store.getState().finishPlayback();

    expect(store.getState().display).toEqual({ coins: 5, baseHp: 80, waveIndex: 3 });
    expect(store.getState().playback).toEqual({ status: 'idle', events: [], cursor: 0 });
  });

  it('clamps a negative run.baseHp to 0 (task 15 req. 3)', () => {
    const storage = createMemoryStorage();
    const run = fakeRunState({ baseHp: -15 });
    storage.setItem(
      scopedKey('/', 'run'),
      JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
    );
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage,
      basePath: '/',
    });
    store.setState({ playback: { status: 'playing', events: [], cursor: 0 } });

    store.getState().finishPlayback();

    expect(store.getState().display.baseHp).toBe(0);
  });

  describe('end of run (task 14 req. 2)', () => {
    for (const phase of ['won', 'lost'] as const) {
      it(`switches to the '${phase}' screen and clears the save once its playback finishes`, () => {
        const storage = createMemoryStorage();
        const store = createAppStore({
          data: fakeGameData(),
          applyCommand: stubApplyCommand,
          storage,
          basePath: '/',
        });
        // Simulate the moment right after `dispatch({ type: 'endTurn' })` resolved the run to
        // `phase` — already saved (dispatch persists immediately), still playing back the final
        // beats.
        const run = fakeRunState({ mode: 'run', phase, baseHp: 0 });
        storage.setItem(
          scopedKey('/', 'run'),
          JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
        );
        store.setState({
          run,
          savedRun: run,
          screen: 'game',
          playback: { status: 'playing', events: [], cursor: 0 },
        });

        store.getState().finishPlayback();

        expect(store.getState().screen).toBe(phase);
        expect(store.getState().playback).toEqual({ status: 'idle', events: [], cursor: 0 });
        expect(store.getState().savedRun).toBeNull();
        expect(storage.getItem(scopedKey('/', 'run'))).toBeNull();
      });
    }

    it('clamps display.baseHp at 0 for a lost run whose final blow took it negative (tasks 14+15 integration)', () => {
      // Neither task's own tests covered this combination: task 14's won/lost fixtures used
      // `baseHp: 0`; task 15's clamp test used a phase that isn't `won`/`lost`. The merged
      // `finishPlayback` runs the same `displayFromRun` clamp on both branches, so a run that
      // lost by taking `baseHp` negative must still show ♥ 0, not a negative number, once the
      // won/lost screen switch and `clearRun` fire.
      const storage = createMemoryStorage();
      const store = createAppStore({
        data: fakeGameData(),
        applyCommand: stubApplyCommand,
        storage,
        basePath: '/',
      });
      const run = fakeRunState({ mode: 'run', phase: 'lost', baseHp: -12 });
      storage.setItem(
        scopedKey('/', 'run'),
        JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
      );
      store.setState({
        run,
        savedRun: run,
        screen: 'game',
        playback: { status: 'playing', events: [], cursor: 0 },
      });

      store.getState().finishPlayback();

      expect(store.getState().screen).toBe('lost');
      expect(store.getState().display.baseHp).toBe(0);
      expect(store.getState().savedRun).toBeNull();
      expect(storage.getItem(scopedKey('/', 'run'))).toBeNull();
    });

    it('leaves the screen and save alone for any other phase', () => {
      const storage = createMemoryStorage();
      const store = createAppStore({
        data: fakeGameData(),
        applyCommand: stubApplyCommand,
        storage,
        basePath: '/',
      });
      const run = fakeRunState({ mode: 'run', phase: 'waveCleared' });
      storage.setItem(
        scopedKey('/', 'run'),
        JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
      );
      store.setState({
        run,
        savedRun: run,
        screen: 'game',
        playback: { status: 'playing', events: [], cursor: 0 },
      });

      store.getState().finishPlayback();

      expect(store.getState().screen).toBe('game');
      expect(store.getState().savedRun).toEqual(run);
      expect(storage.getItem(scopedKey('/', 'run'))).not.toBeNull();
    });
  });
});

describe('setSettings', () => {
  it('merges the patch and persists it', () => {
    const storage = createMemoryStorage();
    const store = createAppStore({
      data: fakeGameData(),
      applyCommand: stubApplyCommand,
      storage,
      basePath: '/',
    });

    store.getState().setSettings({ hints: true });

    expect(store.getState().settings).toEqual({ hints: true, sound: true });
    expect(JSON.parse(storage.getItem(scopedKey('/', 'settings')) ?? 'null')).toEqual({
      hints: true,
      sound: true,
    });
  });
});

describe('isPlaybackActive', () => {
  it('is true while a turn is playing or a Replay is replaying, false when idle', () => {
    expect(isPlaybackActive({ playback: { status: 'idle', events: [], cursor: 0 } })).toBe(false);
    expect(isPlaybackActive({ playback: { status: 'playing', events: [], cursor: 0 } })).toBe(true);
    expect(isPlaybackActive({ playback: { status: 'replaying', events: [], cursor: 0 } })).toBe(
      true,
    );
  });
});

describe('Replay (task 10)', () => {
  // Lane 2: base value 3 exactly kills a 3 HP robot (+2 coins); lane 0 has a robot that survives,
  // so the level does not clear and the run stays in planning.
  const rows = [
    'C . R9 . . . . .',
    '. . . . . . . .',
    'C . R3 . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
  ];

  function playedTurn() {
    // `loadLevel` stands in for any command that installs a fresh run (no levels ship yet).
    const withFreshRun: ApplyCommandFn = (state, cmd, data) =>
      cmd.type === 'loadLevel'
        ? { ok: true, state: boardState(rows), events: [] }
        : applyCommand(state, cmd, data);
    const store = createAppStore({
      data: realData,
      applyCommand: withFreshRun,
      storage: createMemoryStorage(),
      basePath: '/',
    });
    const before = boardState(rows);
    store.setState({ run: before, display: displayFromRun(before) });
    store.getState().dispatch({ type: 'endTurn' });
    return { store, before };
  }

  it('keeps the pre-turn run and the turn events as the replay snapshot', () => {
    const { store, before } = playedTurn();
    const { run, lastTurn, playback } = store.getState();
    expect(lastTurn).toEqual({ before, events: run!.lastTurnEvents });
    expect(lastTurn!.before).toBe(before);
    expect(playback.status).toBe('playing');
    // HUD values lag: nothing committed yet.
    expect(store.getState().display.coins).toBe(before.coins);
    expect(run!.coins).toBe(before.coins + realData.economy.income.exactKill);
  });

  it('is offered only in planning, when idle, with a snapshot and events', () => {
    const { store } = playedTurn();
    expect(canReplay(store.getState())).toBe(false); // still playing
    expect(store.getState().startReplay()).toBe(false);

    store.getState().finishPlayback();
    expect(canReplay(store.getState())).toBe(true);
    // Retained after playback ends.
    expect(store.getState().lastTurn).not.toBeNull();

    const state = store.getState();
    expect(canReplay({ ...state, lastTurn: null })).toBe(false); // e.g. after a reload
    expect(canReplay({ ...state, run: { ...state.run!, lastTurnEvents: [] } })).toBe(false);
    expect(canReplay({ ...state, run: { ...state.run!, phase: 'levelCleared' } })).toBe(false);
  });

  it('plays the last turn visually: dispatches nothing, commits nothing, restores display', () => {
    const { store } = playedTurn();
    store.getState().finishPlayback();
    const { run, display, lastTurn } = store.getState();

    expect(store.getState().startReplay()).toBe(true);
    expect(store.getState().playback).toEqual({
      status: 'replaying',
      events: lastTurn!.events,
      cursor: 0,
      before: lastTurn!.before,
    });
    expect(isPlaybackActive(store.getState())).toBe(true);

    // The Director commits the replayed CoinsChanged — the store ignores it during a replay.
    for (const event of lastTurn!.events) store.getState().commitEvent(event);
    expect(store.getState().display).toEqual(display);

    store.getState().finishPlayback();
    expect(store.getState().run).toBe(run);
    expect(store.getState().display).toEqual(display);
    expect(store.getState().lastTurn).toBe(lastTurn);
    expect(store.getState().playback.status).toBe('idle');
  });

  it('keeps the snapshot through planning commands but drops it when a new run is installed', () => {
    const { store } = playedTurn();
    store.getState().finishPlayback();
    const snapshot = store.getState().lastTurn;

    store.getState().dispatch({ type: 'moveCannon', fromLane: 0, toLane: 1 });
    expect(store.getState().run!.board.cannons[1]).toBe(true);
    expect(store.getState().lastTurn).toBe(snapshot);

    store.getState().dispatch({ type: 'loadLevel', levelId: 'any' });
    expect(store.getState().lastTurn).toBeNull();
  });
});

describe('shop-phase dispatch (task 19)', () => {
  it('buyOffer does not start playback and updates display.coins at once', () => {
    const store = createAppStore({
      data: realData,
      applyCommand,
      storage: createMemoryStorage(),
      basePath: '/',
    });
    store.getState().dispatch({ type: 'newRun', seed: 'buy-no-playback' });
    store.getState().finishPlayback();
    const started = store.getState().run!;
    const lastTurn = {
      before: started,
      events: [{ step: 0, group: 'end', type: 'WaveCleared' as const, waveIndex: 0 }],
    };
    const shopRun: RunState = {
      ...started,
      phase: 'shop',
      coins: 20,
      lastTurnEvents: lastTurn.events,
      shop: {
        afterWave: 1,
        offers: [
          { slot: 'tile:0', kind: 'tile', tileId: 'add:5', price: 4, bought: false },
        ],
      },
    };
    store.setState({
      run: shopRun,
      display: displayFromRun(shopRun),
      playback: { ...store.getState().playback, status: 'idle', events: [], cursor: 0 },
      lastTurn,
    });

    const result = store.getState().dispatch({ type: 'buyOffer', slot: 'tile:0' });
    expect(result).toEqual({ ok: true });
    expect(store.getState().playback.status).toBe('idle');
    expect(store.getState().display.coins).toBe(16);
    expect(store.getState().run?.coins).toBe(16);
    expect(store.getState().lastTurn).toBe(lastTurn);
  });

  it('discards a schema-version-2 save when economy is version 3', () => {
    const storage = createMemoryStorage();
    const saved = fakeRunState({ schemaVersion: 2, mode: 'run' });
    storage.setItem(
      scopedKey('/', 'run'),
      JSON.stringify({ schemaVersion: 2, savedAt: 1, state: saved }),
    );
    const store = createAppStore({
      data: realData,
      applyCommand: stubApplyCommand,
      storage,
      basePath: '/',
    });
    expect(realData.economy.schemaVersion).toBe(3);
    expect(store.getState().run).toBeNull();
  });
});

