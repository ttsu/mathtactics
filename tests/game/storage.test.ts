import { describe, expect, it } from 'vitest';
import {
  addCompletedPuzzle,
  addSeen,
  addSeenMany,
  loadCompletedPuzzles,
  loadRun,
  loadSeen,
  loadSettings,
  saveRun,
  saveSettings,
  scopedKey,
  type StorageLike,
} from '../../game/state/storage';
import type { RunState } from '../../sim/core/types';

// Minimal in-memory Storage-like fixture (no real localStorage needed, TR §13 / task 05 req. 3).
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

function throwingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error('boom');
    },
    setItem: () => {
      throw new Error('boom');
    },
    removeItem: () => {
      throw new Error('boom');
    },
  };
}

function fakeRunState(overrides: Partial<RunState> = {}): RunState {
  return {
    schemaVersion: 1,
    mode: 'level',
    difficulty: 'normal',
    seed: 'seed',
    rng: {
      wave: [1, 2, 3, 4],
      shop: [5, 6, 7, 8],
    },
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
    ...overrides,
  };
}

describe('scopedKey', () => {
  it('scopes a key under the production basePath', () => {
    expect(scopedKey('/', 'run')).toBe('mt:/:run');
  });

  it('scopes a key under a PR preview basePath', () => {
    expect(scopedKey('/pr/pr-12/', 'run')).toBe('mt:/pr/pr-12/:run');
  });

  it('never collides between production and a PR preview', () => {
    expect(scopedKey('/', 'run')).not.toBe(scopedKey('/pr/pr-12/', 'run'));
  });

  it('never collides between two different PR previews', () => {
    expect(scopedKey('/pr/pr-1/', 'run')).not.toBe(scopedKey('/pr/pr-2/', 'run'));
  });
});

describe('saveRun / loadRun', () => {
  it('round-trips a saved run', () => {
    const storage = createMemoryStorage();
    const run = fakeRunState({ coins: 7 });
    saveRun(storage, '/', run, 1234);
    expect(loadRun(storage, '/', 1)).toEqual(run);
  });

  it('is path-scoped: a run saved under one basePath is invisible under another', () => {
    const storage = createMemoryStorage();
    saveRun(storage, '/', fakeRunState({ coins: 1 }), 1);
    expect(loadRun(storage, '/pr/pr-9/', 1)).toBeNull();
  });

  it('discards a save whose schemaVersion does not match, silently', () => {
    const storage = createMemoryStorage();
    saveRun(storage, '/', fakeRunState({ schemaVersion: 1 }), 1);
    expect(loadRun(storage, '/', 2)).toBeNull();
  });

  it('returns null when nothing is saved', () => {
    const storage = createMemoryStorage();
    expect(loadRun(storage, '/', 1)).toBeNull();
  });

  it('returns null (does not throw) on corrupt JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem(scopedKey('/', 'run'), '{not json');
    expect(loadRun(storage, '/', 1)).toBeNull();
  });

  it('does not throw when the underlying storage throws', () => {
    const storage = throwingStorage();
    expect(() => saveRun(storage, '/', fakeRunState(), 1)).not.toThrow();
    expect(() => loadRun(storage, '/', 1)).not.toThrow();
    expect(loadRun(storage, '/', 1)).toBeNull();
  });
});

describe('loadSeen / addSeen', () => {
  it('starts empty', () => {
    const storage = createMemoryStorage();
    expect(loadSeen(storage, '/')).toEqual([]);
  });

  it('is additive, sorted, and de-duplicated', () => {
    const storage = createMemoryStorage();
    addSeen(storage, '/', 'mul:3');
    addSeen(storage, '/', 'add:5');
    const result = addSeen(storage, '/', 'mul:3');
    expect(result).toEqual(['add:5', 'mul:3']);
    expect(loadSeen(storage, '/')).toEqual(['add:5', 'mul:3']);
  });

  it('is unaffected by schemaVersion (no version param)', () => {
    const storage = createMemoryStorage();
    addSeen(storage, '/', 'sub:2');
    expect(loadSeen(storage, '/')).toEqual(['sub:2']);
  });

  it('does not throw when the underlying storage throws', () => {
    const storage = throwingStorage();
    expect(() => addSeen(storage, '/', 'add:1')).not.toThrow();
    expect(loadSeen(storage, '/')).toEqual([]);
  });
});

describe('addSeenMany', () => {
  it('is additive, sorted, and de-duplicated', () => {
    const storage = createMemoryStorage();
    addSeen(storage, '/', 'mul:3');
    const result = addSeenMany(storage, '/', ['add:5', 'mul:3', 'add:1']);
    expect(result).toEqual(['add:1', 'add:5', 'mul:3']);
    expect(loadSeen(storage, '/')).toEqual(['add:1', 'add:5', 'mul:3']);
  });

  it('does not throw when the underlying storage throws', () => {
    const storage = throwingStorage();
    expect(() => addSeenMany(storage, '/', ['add:1', 'sub:2'])).not.toThrow();
    expect(loadSeen(storage, '/')).toEqual([]);
  });
});

describe('loadCompletedPuzzles / addCompletedPuzzle', () => {
  it('starts empty and is additive, sorted, and de-duplicated', () => {
    const storage = createMemoryStorage();
    expect(loadCompletedPuzzles(storage, '/')).toEqual([]);
    addCompletedPuzzle(storage, '/', 'bounce-house');
    const result = addCompletedPuzzle(storage, '/', 'warm-up');
    addCompletedPuzzle(storage, '/', 'warm-up');
    expect(result).toEqual(['bounce-house', 'warm-up']);
    expect(loadCompletedPuzzles(storage, '/')).toEqual(['bounce-house', 'warm-up']);
  });

  it('does not throw when the underlying storage throws', () => {
    const storage = throwingStorage();
    expect(() => addCompletedPuzzle(storage, '/', 'warm-up')).not.toThrow();
    expect(loadCompletedPuzzles(storage, '/')).toEqual([]);
  });
});

describe('loadSettings / saveSettings', () => {
  it('defaults to hints off, sound on, difficulty Normal (GDD §11.8 / §10.7)', () => {
    const storage = createMemoryStorage();
    expect(loadSettings(storage, '/')).toEqual({ hints: false, sound: true, difficulty: 'normal' });
  });

  it('round-trips saved settings', () => {
    const storage = createMemoryStorage();
    saveSettings(storage, '/', { hints: true, sound: false, difficulty: 'easy' });
    expect(loadSettings(storage, '/')).toEqual({ hints: true, sound: false, difficulty: 'easy' });
  });

  it('preserves hints from a pre-M4.5 settings blob and defaults difficulty to Normal', () => {
    const storage = createMemoryStorage();
    storage.setItem(scopedKey('/', 'settings'), JSON.stringify({ hints: true, sound: false }));
    expect(loadSettings(storage, '/')).toEqual({ hints: true, sound: false, difficulty: 'normal' });
  });

  it('does not throw when the underlying storage throws', () => {
    const storage = throwingStorage();
    expect(() =>
      saveSettings(storage, '/', { hints: true, sound: true, difficulty: 'hard' }),
    ).not.toThrow();
    expect(loadSettings(storage, '/')).toEqual({ hints: false, sound: true, difficulty: 'normal' });
  });
});
