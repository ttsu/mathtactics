import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../sim/commands';
import {
  openPuzzleBook,
  puzzleBookTiles,
  replayPuzzle,
  returnToPuzzleBook,
  startPuzzle,
} from '../../game/state/puzzleFlow';
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

describe('puzzleFlow', () => {
  it('opens the book and starts a playable puzzle', () => {
    const store = createStore();
    openPuzzleBook(store);
    expect(store.getState().screen).toBe('levelSelect');
    startPuzzle(store, 'warm-up');
    expect(store.getState().screen).toBe('game');
    expect(store.getState().run?.mode).toBe('puzzle');
    expect(store.getState().run?.puzzleId).toBe('warm-up');
    expect(store.getState().savedRun).toBeNull();
  });

  it('ignores a locked catalog tile', () => {
    const store = createStore();
    startPuzzle(store, 'blue-room');
    expect(store.getState().run).toBeNull();
    expect(store.getState().screen).toBe('menu');
  });

  it('replays the current puzzle from wave 1', () => {
    const store = createStore();
    startPuzzle(store, 'plus-party');
    store.getState().dispatch({ type: 'endTurn' });
    replayPuzzle(store);
    expect(store.getState().run?.waveIndex).toBe(0);
    expect(store.getState().run?.phase).toBe('planning');
    expect(store.getState().run?.puzzleId).toBe('plus-party');
  });

  it('Home from a puzzle returns to the book', () => {
    const store = createStore();
    startPuzzle(store, 'odd-socks');
    store.getState().finishPlayback();
    returnToPuzzleBook(store);
    expect(store.getState().screen).toBe('levelSelect');
  });

  it('shows only playable tiles, easy first', () => {
    const tiles = puzzleBookTiles(realData.puzzles.puzzles);
    expect(tiles.every((puzzle) => puzzle.waves !== undefined)).toBe(true);
    expect(tiles).toHaveLength(12);
    expect(tiles.map((puzzle) => puzzle.id)).toEqual([
      'warm-up',
      'plus-party',
      'five-bolt',
      'times-table',
      'take-away',
      'even-steven',
      'odd-socks',
      'bounce-house',
      'double-trouble',
      'one-cannon',
      'occupied',
      'recipe',
    ]);
    expect(tiles.map((puzzle) => puzzle.stars)).toEqual([1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3]);
  });
});
