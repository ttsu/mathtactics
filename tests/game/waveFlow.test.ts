// Task 16/19: the wave-cleared overlay's derived visibility and coin bonus, and the shop-opening
// double-tap guard — against the real store and the real `applyCommand`, on the fixture's own
// inline `waves:` (not the shipped `waves.json`).

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../sim/commands';
import type { RunState } from '../../sim/core/types';
import { openShopScreen } from '../../game/state/shopFlow';
import { showWaveCleared, waveClearCoins, waveCount } from '../../game/state/waveFlow';
import { createAppStore, IDLE_PLAYBACK } from '../../game/state/store';
import type { StorageLike } from '../../game/state/storage';
import { buildScenarioState, effectiveData, parseScenario } from '../../sim/scenario';
import { realData } from './boardFixtures';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const NEARLY_CLEARED = parseScenario(
  [
    'name: waveFlow fixture',
    'mode: run',
    'baseValue: 5',
    'board:',
    '  - ". . . . . . . ."',
    '  - ". . . . . . . ."',
    '  - "C R5 . . . . . ."',
    '  - ". . . . . . . ."',
    '  - ". . . . . . . ."',
    'waves:',
    '  - id: fixture-wave-1',
    '    spawns:',
    '      - { turn: 1, lane: 0, robot: basic, hp: [1, 1] }',
    '  - id: fixture-wave-2',
    '    spawns:',
    '      - { turn: 1, lane: 1, robot: basic, hp: [4, 4] }',
  ].join('\n'),
);
const fixtureData = effectiveData(NEARLY_CLEARED, realData);

function createStore() {
  return createAppStore({
    data: fixtureData,
    applyCommand,
    storage: createMemoryStorage(),
    basePath: '/',
  });
}

function nearlyClearedRun(): RunState {
  return buildScenarioState(NEARLY_CLEARED, fixtureData);
}

describe('waveCount', () => {
  it('is the length of the data’s wave list', () => {
    expect(waveCount(fixtureData)).toBe(2);
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

  it("never shows outside the game screen, matching showLevelCleared's guard (task 14/16 integration)", () => {
    for (const other of ['menu', 'won', 'lost', 'shop'] as const) {
      expect(showWaveCleared({ run: cleared, playback: IDLE_PLAYBACK, screen: other })).toBe(false);
    }
  });
});

describe('waveClearCoins', () => {
  it('is 0 with no run', () => {
    expect(waveClearCoins(null)).toBe(0);
  });

  it('is 0 when the last turn granted no wave-cleared coins', () => {
    const run = {
      lastTurnEvents: [{ step: 0, group: 'end', type: 'WaveCleared', waveIndex: 0 }],
    } as unknown as RunState;
    expect(waveClearCoins(run)).toBe(0);
  });

  it('reads the CoinsChanged waveCleared delta from the last turn', () => {
    const run = {
      lastTurnEvents: [
        {
          step: 0,
          group: 'end',
          type: 'CoinsChanged',
          delta: 3,
          total: 3,
          reason: 'waveCleared',
        },
      ],
    } as unknown as RunState;
    expect(waveClearCoins(run)).toBe(3);
  });

  it('reflects the wave-cleared bonus after a real wave clear', () => {
    const store = createStore();
    store.setState({
      run: nearlyClearedRun(),
      display: { coins: 0, baseHp: 100, waveIndex: 0 },
      playback: { ...IDLE_PLAYBACK },
    });
    const result = store.getState().dispatch({ type: 'endTurn' });
    expect(result).toEqual({ ok: true });
    expect(store.getState().run?.phase).toBe('waveCleared');
    expect(waveClearCoins(store.getState().run)).toBe(fixtureData.economy.income.waveCleared);
  });
});

describe('openShopScreen (from the wave-cleared overlay)', () => {
  it('opens the shop through the normal dispatch path', () => {
    const store = createStore();
    store.setState({
      run: nearlyClearedRun(),
      display: { coins: 0, baseHp: 100, waveIndex: 0 },
      playback: { ...IDLE_PLAYBACK },
    });
    store.getState().dispatch({ type: 'endTurn' });
    expect(store.getState().run?.phase).toBe('waveCleared');

    openShopScreen(store);
    expect(store.getState().run?.phase).toBe('shop');
    expect(store.getState().screen).toBe('shop');
    expect(store.getState().run?.shop?.offers.length).toBeGreaterThan(0);
  });

  it('a double tap cannot open two shops', () => {
    const store = createStore();
    store.setState({
      run: nearlyClearedRun(),
      display: { coins: 0, baseHp: 100, waveIndex: 0 },
      playback: { ...IDLE_PLAYBACK },
    });
    store.getState().dispatch({ type: 'endTurn' });

    openShopScreen(store);
    const first = store.getState().run?.shop;
    openShopScreen(store);
    expect(store.getState().run?.shop).toEqual(first);
  });

  it('is a no-op outside waveCleared, and with no run', () => {
    const store = createStore();
    openShopScreen(store);
    expect(store.getState().run).toBeNull();

    store.setState({
      run: nearlyClearedRun(),
      display: { coins: 0, baseHp: 100, waveIndex: 0 },
      playback: { ...IDLE_PLAYBACK },
    });
    openShopScreen(store);
    expect(store.getState().run?.phase).toBe('planning');
  });
});
