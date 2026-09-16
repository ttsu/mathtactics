// `nextWave` (GDD §4 step 5, §10.5; TR §5, §6; task 13 requirement 3).

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../../sim/commands/applyCommand';
import { rollWave } from '../../../sim/waves/rollWave';
import { fakeGameData, fakeRunState } from './fixtures';
import type { RunState } from '../../../sim/core/types';
import type { GameData } from '../../../sim/data/schemas';

function twoWaveData(): GameData {
  return fakeGameData({
    robots: [{ id: 'basic', trait: { type: 'none' }, isBoss: false }],
    waves: {
      waves: [
        {
          id: 'wave-1',
          spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [1, 1] }],
        },
        {
          id: 'wave-2',
          spawns: [{ turn: 1, lane: 'A', robot: 'basic', hp: [4, 10] }],
        },
      ],
    },
  });
}

function shopState(overrides: Partial<RunState> = {}): RunState {
  return fakeRunState({
    mode: 'run',
    levelId: undefined,
    phase: 'shop',
    waveIndex: 0,
    turn: 12,
    coins: 7,
    baseHp: 88,
    exactKills: 4,
    pendingSpawns: [],
    shop: {
      afterWave: 1,
      offers: [
        { slot: 'tile:0', kind: 'tile', tileId: 'add:5', price: 4, bought: false },
      ],
    },
    ...overrides,
  });
}

describe('applyCommand — nextWave', () => {
  it('requires phase shop, else wrong_phase', () => {
    const data = twoWaveData();
    for (const phase of ['planning', 'waveCleared', 'won', 'lost', 'levelCleared'] as const) {
      const result = applyCommand(shopState({ phase }), { type: 'nextWave' }, data);
      expect(result).toEqual({ ok: false, error: 'wrong_phase' });
    }
  });

  it('advances waveIndex, resets turn to 1, rolls the next wave, clears shop, and returns to planning', () => {
    const data = twoWaveData();
    const state = shopState();

    const result = applyCommand(state, { type: 'nextWave' }, data);
    if (!result.ok) throw new Error(`expected ok, got "${result.error}"`);

    expect(result.state.waveIndex).toBe(1);
    expect(result.state.turn).toBe(1);
    expect(result.state.phase).toBe('planning');
    expect(result.state.shop).toBeNull();
    expect(result.state.undo).toEqual([]);
    expect(result.state.lastTurnEvents).toEqual([]);

    const rolled = rollWave(data.waves.waves[1]!, state.rng.wave);
    expect(result.state.rng.wave).toEqual(rolled.rng);
    expect(result.state.pendingSpawns).toEqual(rolled.spawns.slice(1));
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.every((e) => e.group === 'spawn')).toBe(true);
  });

  it('carries board, tray, cannons, coins, baseHp, and exactKills over unchanged', () => {
    const data = twoWaveData();
    const state = shopState({
      coins: 7,
      baseHp: 88,
      exactKills: 4,
      tray: ['piece:0'],
      pieces: { 'piece:0': { pieceId: 'piece:0', tileId: 'add:5' } },
    });

    const result = applyCommand(state, { type: 'nextWave' }, data);
    if (!result.ok) throw new Error(`expected ok, got "${result.error}"`);

    expect(result.state.coins).toBe(7);
    expect(result.state.baseHp).toBe(88);
    expect(result.state.exactKills).toBe(4);
    expect(result.state.tray).toEqual(['piece:0']);
    expect(result.state.pieces).toEqual({ 'piece:0': { pieceId: 'piece:0', tileId: 'add:5' } });
    expect(result.state.board.cannons).toEqual(state.board.cannons);
  });

  it('does not mutate the state it starts from', () => {
    const data = twoWaveData();
    const state = shopState();
    const snapshot = structuredClone(state);

    applyCommand(state, { type: 'nextWave' }, data);

    expect(state).toEqual(snapshot);
  });
});

describe('exactKills across waves (GDD §10.6)', () => {
  it('keeps counting after nextWave — carried over, not reset', () => {
    const data = twoWaveData();
    const cleared = shopState({ exactKills: 5 });

    const result = applyCommand(cleared, { type: 'nextWave' }, data);
    if (!result.ok) throw new Error(`expected ok, got "${result.error}"`);

    expect(result.state.exactKills).toBe(5);
  });
});
