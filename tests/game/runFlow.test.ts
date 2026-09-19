// Task 14: the M2 run flow (▶ Continue / New Run, ⌂ Home) against the real store, the real
// `applyCommand`, and the real shipped data.

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../sim/commands';
import type { RunState } from '../../sim/core/types';
import { firstLevelId, startLevel } from '../../game/state/levelFlow';
import {
  canContinue,
  continueRun,
  goHome,
  isResumable,
  startNewRun,
} from '../../game/state/runFlow';
import { createAppStore } from '../../game/state/store';
import type { StorageLike } from '../../game/state/storage';
import { realData } from './boardFixtures';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

function createStore() {
  return createAppStore({
    data: realData,
    applyCommand,
    storage: createMemoryStorage(),
    basePath: '/',
  });
}

describe('isResumable', () => {
  const base: RunState = {
    schemaVersion: realData.economy.schemaVersion,
    mode: 'run',
    difficulty: 'normal',
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
    lastTurnEvents: [],
    shop: null,
    nextIds: { robot: 0, piece: 0, ball: 0 },
  };

  it('is true for a run in planning, waveCleared, or shop', () => {
    expect(isResumable(base)).toBe(true);
    expect(isResumable({ ...base, phase: 'waveCleared' })).toBe(true);
    expect(isResumable({ ...base, phase: 'shop' })).toBe(true);
  });

  it('is false for won, lost, or a level-mode state', () => {
    expect(isResumable({ ...base, phase: 'won' })).toBe(false);
    expect(isResumable({ ...base, phase: 'lost' })).toBe(false);
    expect(isResumable({ ...base, mode: 'level' })).toBe(false);
  });

  it('is false for null (nothing saved)', () => {
    expect(isResumable(null)).toBe(false);
  });
});

describe('New Run', () => {
  it('starts a fresh run, shows the game screen, and offers no Replay yet', () => {
    const store = createStore();

    startNewRun(store);

    const { run, screen, playback } = store.getState();
    expect(screen).toBe('game');
    expect(run?.mode).toBe('run');
    expect(run?.phase).toBe('planning');
    expect(run?.waveIndex).toBe(0);
    expect(run?.board.robots.length).toBeGreaterThan(0); // wave 1's turn-1 spawn(s)
    // A fresh run's turn-1 spawn plays back like any resolution, but Replay stays off (req. 2).
    expect(playback.status).toBe('playing');
    expect(store.getState().lastTurn).toBeNull();
  });

  it('is immediately resumable — dispatch persisted it (mode: run)', () => {
    const store = createStore();
    startNewRun(store);
    expect(canContinue(store.getState())).toBe(true);
  });

  it('replaces a previously saved run with a different seed', () => {
    const store = createStore();
    startNewRun(store);
    const first = store.getState().run!;

    startNewRun(store);
    const second = store.getState().run!;

    expect(second.seed).not.toBe(first.seed);
    expect(store.getState().savedRun).toEqual(second);
  });

  it('writes the chosen difficulty onto the run (task 29)', () => {
    const store = createStore();
    startNewRun(store, 'easy');
    expect(store.getState().run?.difficulty).toBe('easy');
    expect(store.getState().run?.mode).toBe('run');
    // Wave-1 Easy band is 75% of [1, 3] → [1, 2]; overlay actually applied.
    const hps = [
      ...(store.getState().run?.board.robots.map((robot) => robot.hp) ?? []),
      ...(store.getState().run?.pendingSpawns.map((spawn) => spawn.hp) ?? []),
    ];
    expect(hps.length).toBeGreaterThan(0);
    expect(hps.every((hp) => hp <= 2)).toBe(true);
  });

  it('uses settings.difficulty when startNewRun is called without an argument', () => {
    const store = createStore();
    store.getState().setSettings({ difficulty: 'hard' });
    startNewRun(store);
    expect(store.getState().run?.difficulty).toBe('hard');
  });

  it('Settings difficulty does not retcon a saved Easy run', () => {
    const store = createStore();
    startNewRun(store, 'easy');
    store.getState().finishPlayback();
    const saved = store.getState().savedRun!;
    expect(saved.difficulty).toBe('easy');

    store.getState().setSettings({ difficulty: 'hard' });
    expect(store.getState().run?.difficulty).toBe('easy');
    expect(store.getState().savedRun?.difficulty).toBe('easy');

    goHome(store);
    continueRun(store);
    expect(store.getState().run?.difficulty).toBe('easy');
    expect(store.getState().run?.seed).toBe(saved.seed);
  });
});

describe('Continue', () => {
  it('is not offered with nothing saved', () => {
    const store = createStore();
    expect(canContinue(store.getState())).toBe(false);
  });

  it('restores the saved run to the game screen, with no playback and no Replay snapshot', () => {
    const store = createStore();
    startNewRun(store);
    store.getState().finishPlayback(); // finish the spawn playback, land in planning
    store.getState().dispatch({ type: 'endTurn' }); // give it a lastTurn to make sure it's dropped
    const saved = store.getState().savedRun!;
    store.setState({ screen: 'menu' }); // simulate having navigated back (e.g. via Home)

    continueRun(store);

    expect(store.getState().screen).toBe('game');
    expect(store.getState().run).toEqual(saved);
    expect(store.getState().playback).toEqual({ status: 'idle', events: [], cursor: 0 });
    expect(store.getState().lastTurn).toBeNull();
  });

  it('restores a run saved in waveCleared, phase intact (the overlay reappears)', () => {
    const store = createStore();
    startNewRun(store);
    store.getState().finishPlayback();
    // Force the saved run into `waveCleared` directly (task 13's real transition is exercised
    // elsewhere) — Continue only needs to trust `savedRun` as given.
    const forced = { ...store.getState().run!, phase: 'waveCleared' as const };
    store.setState({ run: forced, savedRun: forced, screen: 'menu' });

    continueRun(store);

    expect(store.getState().screen).toBe('game');
    expect(store.getState().run?.phase).toBe('waveCleared');
  });

  it('after Puzzles replaces `run` in memory, Continue still restores the saved run (memory copy, task 14 report)', () => {
    const store = createStore();
    startNewRun(store);
    store.getState().finishPlayback();
    const savedRun = store.getState().savedRun!;

    // Play a Puzzle: `run` now points at a level-mode state, but `savedRun` must be untouched.
    startLevel(store, firstLevelId(realData));
    expect(store.getState().run?.mode).toBe('level');
    expect(canContinue(store.getState())).toBe(true);

    continueRun(store);

    expect(store.getState().run).toEqual(savedRun);
    expect(store.getState().screen).toBe('game');
  });

  it('restores a run saved in shop onto the shop screen, offers intact', () => {
    const store = createStore();
    startNewRun(store);
    store.getState().finishPlayback();
    const forced: RunState = {
      ...store.getState().run!,
      phase: 'shop',
      shop: {
        afterWave: 1,
        offers: [
          { slot: 'tile:0', kind: 'tile', tileId: 'add:1', price: 4, bought: true },
        ],
      },
    };
    store.setState({ run: forced, savedRun: forced, screen: 'menu' });

    continueRun(store);

    expect(store.getState().screen).toBe('shop');
    expect(store.getState().run?.phase).toBe('shop');
    expect(store.getState().run?.shop?.offers[0]).toMatchObject({ slot: 'tile:0', bought: true });
  });

  it('is ignored when nothing is resumable (no-op, no crash)', () => {
    const store = createStore();
    startLevel(store, firstLevelId(realData));
    const before = store.getState().run;

    continueRun(store);

    expect(store.getState().run).toBe(before);
    expect(store.getState().screen).toBe('game');
  });
});

describe('goHome', () => {
  it('shows the menu without touching run or savedRun', () => {
    const store = createStore();
    startNewRun(store);
    store.getState().finishPlayback();
    const run = store.getState().run;
    const savedRun = store.getState().savedRun;

    goHome(store);

    expect(store.getState().screen).toBe('menu');
    expect(store.getState().run).toBe(run);
    expect(store.getState().savedRun).toBe(savedRun);
  });

  it('is refused while playback is active', () => {
    const store = createStore();
    startNewRun(store); // playback is mid-flight (the wave-1 spawn)
    expect(store.getState().playback.status).toBe('playing');

    goHome(store);

    expect(store.getState().screen).toBe('game');
  });

  it('drops a Puzzle session (level mode) without saving anything', () => {
    const store = createStore();
    startLevel(store, firstLevelId(realData));

    goHome(store);

    expect(store.getState().screen).toBe('menu');
    expect(store.getState().savedRun).toBeNull();
  });
});
