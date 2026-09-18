import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../sim/commands';
import { createAppStore } from '../../game/state/store';
import { loadRun, scopedKey, type StorageLike } from '../../game/state/storage';
import { debugAddTile, debugJumpToLevel, debugJumpToWave } from '../../game/state/debug';
import { realData } from './boardFixtures';

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

describe('installRun', () => {
  it('persists a debug wave jump so Continue can resume it', () => {
    const storage = createMemoryStorage();
    const store = createAppStore({
      data: realData,
      applyCommand,
      storage,
      basePath: '/',
      now: () => 42,
    });
    const jumped = debugJumpToWave(null, realData, 2, 'debug-install');
    expect(jumped.ok).toBe(true);
    if (!jumped.ok) return;
    store.getState().installRun(jumped.run);
    expect(store.getState().screen).toBe('game');
    expect(store.getState().run?.waveIndex).toBe(2);
    expect(store.getState().savedRun?.waveIndex).toBe(2);
    expect(store.getState().playback.status).toBe('idle');
    expect(loadRun(storage, '/', realData.economy.schemaVersion)?.waveIndex).toBe(2);
    expect(storage.getItem(scopedKey('/', 'run'))).toContain('"waveIndex":2');
  });

  it('does not overwrite a saved run when installing a puzzle', () => {
    const storage = createMemoryStorage();
    const store = createAppStore({
      data: realData,
      applyCommand,
      storage,
      basePath: '/',
      now: () => 42,
    });
    const wave = debugJumpToWave(null, realData, 1, 'keep-me');
    expect(wave.ok).toBe(true);
    if (!wave.ok) return;
    store.getState().installRun(wave.run);

    const puzzle = debugJumpToLevel(realData, 'level-4');
    expect(puzzle.ok).toBe(true);
    if (!puzzle.ok) return;
    store.getState().installRun(puzzle.run);
    expect(store.getState().run?.mode).toBe('level');
    expect(store.getState().savedRun?.waveIndex).toBe(1);
    expect(loadRun(storage, '/', realData.economy.schemaVersion)?.waveIndex).toBe(1);
  });

  it('refreshes display from the installed run and grants a debug tile', () => {
    const store = createAppStore({
      data: realData,
      applyCommand,
      storage: createMemoryStorage(),
      basePath: '/',
    });
    const withTile = debugAddTile(null, realData, 'mul:2', 'tile-seed');
    expect(withTile.ok).toBe(true);
    if (!withTile.ok) return;
    store.getState().installRun(withTile.run);
    expect(store.getState().display).toEqual({
      coins: withTile.run.coins,
      baseHp: withTile.run.baseHp,
      waveIndex: withTile.run.waveIndex,
    });
    expect(store.getState().run?.tray).toHaveLength(1);
  });
});
