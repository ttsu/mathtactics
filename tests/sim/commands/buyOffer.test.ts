// `buyOffer` (GDD §8.6, TR §5/§7, task 19).

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../../sim/commands/applyCommand';
import type { RunState, ShopOffer } from '../../../sim/core/types';
import { fakeGameData, fakeRunState } from './fixtures';
import { expectEventSequence } from '../../helpers/eventSequence';

const TILE: ShopOffer = {
  slot: 'tile:0',
  kind: 'tile',
  tileId: 'add:5',
  price: 4,
  bought: false,
};
const CANNON: ShopOffer = {
  slot: 'cannon',
  kind: 'cannon',
  price: 10,
  bought: false,
  available: true,
};
const UPGRADE: ShopOffer = {
  slot: 'upgrade',
  kind: 'upgrade',
  price: 12,
  bought: false,
  fromValue: 1,
  toValue: 2,
};

function shopState(overrides: Partial<RunState> = {}, offers: ShopOffer[] = [TILE, CANNON, UPGRADE]) {
  return fakeRunState({
    mode: 'run',
    levelId: undefined,
    phase: 'shop',
    coins: 20,
    shop: { afterWave: 1, offers },
    ...overrides,
  });
}

const data = fakeGameData();

describe('applyCommand — buyOffer', () => {
  it('requires phase shop, else wrong_phase', () => {
    const result = applyCommand(
      fakeRunState({ phase: 'planning', shop: { afterWave: 1, offers: [TILE] } }),
      { type: 'buyOffer', slot: 'tile:0' },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'wrong_phase' });
  });

  it('rejects an unknown slot as offer_unavailable', () => {
    const result = applyCommand(shopState(), { type: 'buyOffer', slot: 'tile:9' }, data);
    expect(result).toEqual({ ok: false, error: 'offer_unavailable' });
  });

  it('rejects an already-bought slot as offer_unavailable', () => {
    const offers: ShopOffer[] = [{ ...TILE, bought: true }, CANNON, UPGRADE];
    const result = applyCommand(shopState({}, offers), { type: 'buyOffer', slot: 'tile:0' }, data);
    expect(result).toEqual({ ok: false, error: 'offer_unavailable' });
  });

  it('rejects a cannon slot with available: false as offer_unavailable', () => {
    const offers: ShopOffer[] = [TILE, { ...CANNON, available: false }, UPGRADE];
    const result = applyCommand(
      shopState({ board: { ...shopState().board, cannons: [true, true, true, true, true] } }, offers),
      { type: 'buyOffer', slot: 'cannon' },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'offer_unavailable' });
  });

  it('rejects a purchase the player cannot afford as insufficient_coins', () => {
    const result = applyCommand(shopState({ coins: 3 }), { type: 'buyOffer', slot: 'tile:0' }, data);
    expect(result).toEqual({ ok: false, error: 'insufficient_coins' });
  });

  it('deducts coins, marks the slot bought, and appends a tile to the tray', () => {
    const start = shopState({ tray: ['piece:keep'], nextIds: { robot: 0, piece: 3, ball: 0 } });
    const rng = start.rng;
    const result = applyCommand(start, { type: 'buyOffer', slot: 'tile:0' }, data);
    if (!result.ok) throw new Error(`expected ok, got "${result.error}"`);

    expect(result.state.coins).toBe(16);
    expect(result.state.tray).toEqual(['piece:keep', 'piece:3']);
    expect(result.state.pieces['piece:3']).toEqual({ pieceId: 'piece:3', tileId: 'add:5' });
    expect(result.state.shop?.offers[0]?.bought).toBe(true);
    expect(result.state.rng).toEqual(rng);
    expect(result.state.undo).toEqual([]);
    expectEventSequence(result.events, [
      { type: 'OfferBought', slot: 'tile:0', kind: 'tile', price: 4, step: 0, group: 'shop' },
      { type: 'TilesGranted', tiles: [{ pieceId: 'piece:3', tileId: 'add:5' }], step: 1 },
      { type: 'CoinsChanged', delta: -4, total: 16, reason: 'purchase', step: 2 },
    ]);
  });

  it('places a cannon in the topmost empty slot', () => {
    const start = shopState({
      board: {
        cannons: [true, false, true, false, false],
        cells: fakeRunState().board.cells,
        robots: [],
      },
    });
    const result = applyCommand(start, { type: 'buyOffer', slot: 'cannon' }, data);
    if (!result.ok) throw new Error(`expected ok, got "${result.error}"`);

    expect(result.state.board.cannons).toEqual([true, true, true, false, false]);
    expectEventSequence(result.events, [
      { type: 'OfferBought', slot: 'cannon', kind: 'cannon' },
      { type: 'CannonPlaced', lane: 1 },
      { type: 'CoinsChanged', reason: 'purchase', delta: -10 },
    ]);
  });

  it('raises cannonBaseValue and upgradesBought for an upgrade', () => {
    const start = shopState({ cannonBaseValue: 1, upgradesBought: 0 });
    const result = applyCommand(start, { type: 'buyOffer', slot: 'upgrade' }, data);
    if (!result.ok) throw new Error(`expected ok, got "${result.error}"`);

    expect(result.state.cannonBaseValue).toBe(2);
    expect(result.state.upgradesBought).toBe(1);
    expectEventSequence(result.events, [
      { type: 'OfferBought', slot: 'upgrade', kind: 'upgrade' },
      { type: 'BaseValueChanged', from: 1, to: 2 },
      { type: 'CoinsChanged', reason: 'purchase', delta: -12, total: 8 },
    ]);
  });

  it('leaves rng.shop untouched', () => {
    const start = shopState();
    const result = applyCommand(start, { type: 'buyOffer', slot: 'tile:0' }, data);
    if (!result.ok) throw new Error(`expected ok, got "${result.error}"`);
    expect(result.state.rng).toEqual(start.rng);
  });

  it('asserts rather than no-op when a cannon is bought with every slot full', () => {
    const offers: ShopOffer[] = [TILE, { ...CANNON, available: true }, UPGRADE];
    const start = shopState(
      { board: { cannons: [true, true, true, true, true], cells: fakeRunState().board.cells, robots: [] } },
      offers,
    );
    expect(() => applyCommand(start, { type: 'buyOffer', slot: 'cannon' }, data)).toThrow(
      /every slot full/,
    );
  });
});

describe('applyCommand — undo in the shop', () => {
  it('is refused in phase shop even when an undo snapshot is sitting on the stack', () => {
    const state = shopState({
      undo: [{ cells: fakeRunState().board.cells, tray: [], cannons: [true, false, false, false, false] }],
    });
    expect(applyCommand(state, { type: 'undo' }, data)).toEqual({ ok: false, error: 'wrong_phase' });
  });
});
