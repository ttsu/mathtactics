// `openShop` (GDD §8.3/§8.5, TR §5, task 19).

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../../sim/commands/applyCommand';
import { rollShop } from '../../../sim/shop/rollShop';
import type { GameData } from '../../../sim/data/schemas';
import { fakeGameData, fakeRunState } from './fixtures';
import { fakeShop } from '../../helpers/shop';

function twoWaveData(): GameData {
  return fakeGameData({
    robots: [{ id: 'basic', trait: { type: 'none' }, isBoss: false }],
    shop: fakeShop({
      shops: [
        {
          afterWave: 1,
          guarantees: [],
          table: [{ kind: 'add', n: [5, 5], weight: 1 }],
        },
      ],
    }),
    waves: {
      waves: [
        { id: 'wave-1', spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [1, 1] }] },
        { id: 'wave-2', spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [4, 4] }] },
      ],
    },
  });
}

function waveClearedState() {
  return fakeRunState({
    mode: 'run',
    levelId: undefined,
    phase: 'waveCleared',
    waveIndex: 0,
  });
}

describe('applyCommand — openShop', () => {
  it('requires phase waveCleared, else wrong_phase', () => {
    const data = twoWaveData();
    for (const phase of ['planning', 'shop', 'won', 'lost', 'levelCleared'] as const) {
      const result = applyCommand(fakeRunState({ phase }), { type: 'openShop' }, data);
      expect(result).toEqual({ ok: false, error: 'wrong_phase' });
    }
  });

  it('rolls offers once, stores them, advances rng.shop, and emits no events', () => {
    const data = twoWaveData();
    const state = waveClearedState();
    const expected = rollShop(1, state, data);

    const result = applyCommand(state, { type: 'openShop' }, data);
    if (!result.ok) throw new Error(`expected ok, got "${result.error}"`);

    expect(result.events).toEqual([]);
    expect(result.state.phase).toBe('shop');
    expect(result.state.shop).toEqual({ afterWave: 1, offers: expected.offers });
    expect(result.state.rng.shop).toEqual(expected.rng);
    expect(result.state.rng.wave).toEqual(state.rng.wave);
    expect(result.state.lastTurnEvents).toBe(state.lastTurnEvents);
  });

  it('rolling the shop and buying does not advance the wave stream', () => {
    const data = twoWaveData();
    const cleared = waveClearedState();

    const withoutBuy = applyCommand(cleared, { type: 'openShop' }, data);
    if (!withoutBuy.ok) throw new Error(withoutBuy.error);
    const skip = applyCommand(withoutBuy.state, { type: 'nextWave' }, data);
    if (!skip.ok) throw new Error(skip.error);

    const withBuyOpen = applyCommand(cleared, { type: 'openShop' }, data);
    if (!withBuyOpen.ok) throw new Error(withBuyOpen.error);
    const bought = applyCommand(
      { ...withBuyOpen.state, coins: 20 },
      { type: 'buyOffer', slot: 'tile:0' },
      data,
    );
    if (!bought.ok) throw new Error(bought.error);
    const afterBuy = applyCommand(bought.state, { type: 'nextWave' }, data);
    if (!afterBuy.ok) throw new Error(afterBuy.error);

    expect(afterBuy.state.pendingSpawns).toEqual(skip.state.pendingSpawns);
    expect(afterBuy.state.rng.wave).toEqual(skip.state.rng.wave);
    expect(afterBuy.state.board.robots.map((r) => r.hp)).toEqual(
      skip.state.board.robots.map((r) => r.hp),
    );
  });
});
