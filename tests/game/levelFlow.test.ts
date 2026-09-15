// Task 11: the puzzle-level sequence and flow steps (▶ Play, ▶ Next, ▶ Play again), against the
// real store, the real `applyCommand` and the real shipped `levels.json`.

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../sim/commands';
import type { RunState } from '../../sim/core/types';
import {
  continueToNextLevel,
  firstLevelId,
  levelPosition,
  nextLevelId,
  playFromStart,
  showLevelCleared,
  startLevel,
} from '../../game/state/levelFlow';
import { createAppStore, IDLE_PLAYBACK } from '../../game/state/store';
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

const LEVEL_IDS = realData.levels.levels.map((level) => level.id);

/** Marks the store's current run cleared with playback idle, as if its final turn just played. */
function clearCurrentLevel(store: ReturnType<typeof createStore>): void {
  const run = store.getState().run!;
  store.setState({ run: { ...run, phase: 'levelCleared' }, playback: { ...IDLE_PLAYBACK } });
}

describe('level sequence', () => {
  it('follows levels.json order', () => {
    expect(firstLevelId(realData)).toBe(LEVEL_IDS[0]);
    expect(levelPosition(realData, LEVEL_IDS[2])).toEqual({ index: 2, count: LEVEL_IDS.length });
    expect(nextLevelId(realData, LEVEL_IDS[0])).toBe(LEVEL_IDS[1]);
  });

  it('has no next level after the last one', () => {
    expect(nextLevelId(realData, LEVEL_IDS.at(-1))).toBeNull();
  });

  it('treats a level outside the sequence as not placed, continuing with the first level', () => {
    expect(levelPosition(realData, 'scenario:foo')).toBeNull();
    expect(levelPosition(realData, undefined)).toBeNull();
    expect(nextLevelId(realData, 'scenario:foo')).toBe(LEVEL_IDS[0]);
  });
});

describe('showLevelCleared', () => {
  const cleared = { phase: 'levelCleared' } as RunState;

  it('shows once the level is cleared and playback is idle, on the game screen', () => {
    expect(showLevelCleared({ run: cleared, playback: IDLE_PLAYBACK, screen: 'game' })).toBe(true);
  });

  it('waits for the final kill beat to finish playing', () => {
    const playing = { status: 'playing' as const, events: [], cursor: 0 };
    expect(showLevelCleared({ run: cleared, playback: playing, screen: 'game' })).toBe(false);
  });

  it('never shows while planning, with no run, or off the game screen', () => {
    const planning = { phase: 'planning' } as RunState;
    expect(showLevelCleared({ run: planning, playback: IDLE_PLAYBACK, screen: 'game' })).toBe(
      false,
    );
    expect(showLevelCleared({ run: null, playback: IDLE_PLAYBACK, screen: 'game' })).toBe(false);
    expect(showLevelCleared({ run: cleared, playback: IDLE_PLAYBACK, screen: 'allDone' })).toBe(
      false,
    );
  });
});

describe('flow steps', () => {
  it('the app opens on the main menu', () => {
    expect(createStore().getState().screen).toBe('menu');
  });

  it('▶ Play loads the first level and shows the game', () => {
    const store = createStore();
    playFromStart(store);
    expect(store.getState().screen).toBe('game');
    expect(store.getState().run?.levelId).toBe(LEVEL_IDS[0]);
    expect(store.getState().run?.phase).toBe('planning');
  });

  it('startLevel loads any level and shows the game', () => {
    const store = createStore();
    startLevel(store, LEVEL_IDS[4]!);
    expect(store.getState().screen).toBe('game');
    expect(store.getState().run?.levelId).toBe(LEVEL_IDS[4]);
  });

  it('▶ Next walks every level in order, then shows all done; ▶ Play again restarts', () => {
    const store = createStore();
    playFromStart(store);

    for (const id of LEVEL_IDS.slice(1)) {
      clearCurrentLevel(store);
      continueToNextLevel(store);
      expect(store.getState().run?.levelId).toBe(id);
      expect(store.getState().screen).toBe('game');
    }

    clearCurrentLevel(store);
    continueToNextLevel(store);
    expect(store.getState().screen).toBe('allDone');

    playFromStart(store);
    expect(store.getState().screen).toBe('game');
    expect(store.getState().run?.levelId).toBe(LEVEL_IDS[0]);
    expect(store.getState().run?.phase).toBe('planning');
  });

  it('▶ Next is ignored unless the level is cleared (a double tap cannot skip a level)', () => {
    const store = createStore();
    playFromStart(store);
    clearCurrentLevel(store);
    continueToNextLevel(store);
    continueToNextLevel(store);
    expect(store.getState().run?.levelId).toBe(LEVEL_IDS[1]);
  });

  it('a really solved level 1 clears, shows the overlay after playback, and ▶ Next goes to level 2', () => {
    const store = createStore();
    playFromStart(store);
    store.getState().dispatch({ type: 'endTurn' });
    expect(store.getState().run?.phase).toBe('levelCleared');
    expect(showLevelCleared(store.getState())).toBe(false); // the kill beat hasn't played yet
    store.getState().finishPlayback();
    expect(showLevelCleared(store.getState())).toBe(true);

    continueToNextLevel(store);
    expect(store.getState().run?.levelId).toBe(LEVEL_IDS[1]);
    expect(showLevelCleared(store.getState())).toBe(false);
  });
});
