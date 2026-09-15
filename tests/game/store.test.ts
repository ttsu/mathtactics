import { describe, expect, it, vi } from 'vitest';
import {
  createAppStore,
  isPlaybackActive,
  displayFromRun,
  stubApplyCommand,
  type ApplyCommandFn,
  type Playback,
} from '../../game/state/store';
import { scopedKey, type StorageLike } from '../../game/state/storage';
import type { GameData } from '../../sim/data/schemas';
import type { RunState } from '../../sim/core/types';
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
    waveIndex: 2,
    turn: 1,
    baseHp: 42,
    coins: 9,
    cannonBaseValue: 1,
    upgradesBought: 0,
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
    expect(store.getState().display).toEqual(displayFromRun(savedRun));
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
    const bootstrapped = fakeRunState({ coins: 3 });
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
    const run = fakeRunState();
    storage.setItem(
      scopedKey('/', 'run'),
      JSON.stringify({ schemaVersion: 1, savedAt: 1, state: run }),
    );
    const nextRun = fakeRunState({ coins: 99 });
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
  it('is true only while playback is playing', () => {
    expect(isPlaybackActive({ playback: { status: 'idle', events: [], cursor: 0 } })).toBe(false);
    expect(isPlaybackActive({ playback: { status: 'playing', events: [], cursor: 0 } })).toBe(true);
  });
});
