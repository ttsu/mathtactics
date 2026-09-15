// Task 16: the wave-cleared overlay's derived visibility and reward tiles, and ▶ Next's
// double-tap guard — against the real store, the real `applyCommand`, and the real shipped
// `waves.json`.

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../sim/commands';
import type { RunState } from '../../sim/core/types';
import { continueToNextWave, showWaveCleared, waveCount, waveRewardTiles } from '../../game/state/waveFlow';
import { createAppStore, IDLE_PLAYBACK } from '../../game/state/store';
import type { StorageLike } from '../../game/state/storage';
import { buildScenarioState, parseScenario } from '../../sim/scenario';
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

/** A run one exact kill away from clearing wave 1 (mirrors `scenarios/run/wave-clear-coins-and-
 * tiles.scenario.yaml`), against the real shipped `waves.json` (wave 1 rewards `add:1/2/3`). */
function nearlyClearedRun(): RunState {
  const yaml = [
    'name: waveFlow fixture',
    'mode: run',
    'baseValue: 5',
    'board:',
    '  - ". . . . . . . ."',
    '  - ". . . . . . . ."',
    '  - "C R5 . . . . . ."',
    '  - ". . . . . . . ."',
    '  - ". . . . . . . ."',
  ].join('\n');
  return buildScenarioState(parseScenario(yaml), realData);
}

describe('waveCount', () => {
  it('reads the shipped waves.json length', () => {
    expect(waveCount(realData)).toBe(realData.waves.waves.length);
    expect(waveCount(realData)).toBeGreaterThan(0);
  });
});

describe('showWaveCleared', () => {
  const cleared = { mode: 'run', phase: 'waveCleared' } as RunState;
  const screen = 'game' as const;

  it('shows once a run wave clears and playback is idle', () => {
    expect(showWaveCleared({ run: cleared, playback: IDLE_PLAYBACK, screen })).toBe(true);
  });

  it('waits for playback to finish', () => {
    const playing = { status: 'playing' as const, events: [], cursor: 0 };
    expect(showWaveCleared({ run: cleared, playback: playing, screen })).toBe(false);
  });

  it('never shows outside run mode, outside waveCleared, or with no run', () => {
    const levelMode = { mode: 'level', phase: 'waveCleared' } as unknown as RunState;
    const planning = { mode: 'run', phase: 'planning' } as RunState;
    expect(showWaveCleared({ run: levelMode, playback: IDLE_PLAYBACK, screen })).toBe(false);
    expect(showWaveCleared({ run: planning, playback: IDLE_PLAYBACK, screen })).toBe(false);
    expect(showWaveCleared({ run: null, playback: IDLE_PLAYBACK, screen })).toBe(false);
  });

  it('never shows outside the game screen, matching showLevelCleared\'s guard (task 14/16 integration)', () => {
    for (const other of ['menu', 'won', 'lost'] as const) {
      expect(showWaveCleared({ run: cleared, playback: IDLE_PLAYBACK, screen: other })).toBe(
        false,
      );
    }
  });
});

describe('waveRewardTiles', () => {
  it('is empty with no run', () => {
    expect(waveRewardTiles(null)).toEqual([]);
  });

  it('is empty when the last turn granted nothing', () => {
    const run = { lastTurnEvents: [{ step: 0, group: 'end', type: 'WaveCleared', waveIndex: 0 }] } as unknown as RunState;
    expect(waveRewardTiles(run)).toEqual([]);
  });

  it('reads the TilesGranted tiles from the last turn', () => {
    const tiles = [{ pieceId: 'piece:0', tileId: 'add:5' as const }];
    const run = {
      lastTurnEvents: [{ step: 0, group: 'end', type: 'TilesGranted', tiles }],
    } as unknown as RunState;
    expect(waveRewardTiles(run)).toBe(tiles);
  });

  it('reflects the real wave-1 reward after a real wave clear', () => {
    const store = createStore();
    store.setState({
      run: nearlyClearedRun(),
      display: { coins: 0, baseHp: 100, waveIndex: 0 },
      playback: { ...IDLE_PLAYBACK },
    });
    const result = store.getState().dispatch({ type: 'endTurn' });
    expect(result).toEqual({ ok: true });
    expect(store.getState().run?.phase).toBe('waveCleared');
    expect(waveRewardTiles(store.getState().run)).toEqual([
      { pieceId: expect.any(String), tileId: 'add:1' },
      { pieceId: expect.any(String), tileId: 'add:2' },
      { pieceId: expect.any(String), tileId: 'add:3' },
    ]);
  });
});

describe('continueToNextWave', () => {
  it('starts the next wave through the normal dispatch path', () => {
    const store = createStore();
    store.setState({
      run: nearlyClearedRun(),
      display: { coins: 0, baseHp: 100, waveIndex: 0 },
      playback: { ...IDLE_PLAYBACK },
    });
    store.getState().dispatch({ type: 'endTurn' });
    expect(store.getState().run?.phase).toBe('waveCleared');

    continueToNextWave(store);
    expect(store.getState().run?.phase).toBe('planning');
    expect(store.getState().run?.waveIndex).toBe(1);
  });

  it('a double tap cannot start two waves', () => {
    const store = createStore();
    store.setState({
      run: nearlyClearedRun(),
      display: { coins: 0, baseHp: 100, waveIndex: 0 },
      playback: { ...IDLE_PLAYBACK },
    });
    store.getState().dispatch({ type: 'endTurn' });

    continueToNextWave(store);
    continueToNextWave(store);
    expect(store.getState().run?.waveIndex).toBe(1);
  });

  it('is a no-op outside waveCleared, and with no run', () => {
    const store = createStore();
    continueToNextWave(store); // no run yet
    expect(store.getState().run).toBeNull();

    store.setState({
      run: nearlyClearedRun(),
      display: { coins: 0, baseHp: 100, waveIndex: 0 },
      playback: { ...IDLE_PLAYBACK },
    });
    continueToNextWave(store); // still planning, not waveCleared
    expect(store.getState().run?.phase).toBe('planning');
  });
});
