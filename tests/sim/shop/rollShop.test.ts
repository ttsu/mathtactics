import { describe, expect, it } from 'vitest';
import { createStreams } from '../../../sim/core/rng';
import type { TileId } from '../../../sim/core/types';
import { parseGameData } from '../../../sim/data/load';
import type { GameData, ShopFile } from '../../../sim/data/schemas';
import { cannonPrice } from '../../../sim/shop/pricing';
import { rollShop } from '../../../sim/shop/rollShop';
import { fakeRunState } from '../commands/fixtures';
import { loadRawGameData } from '../../helpers/loadDataFiles';
import { fakeShop } from '../../helpers/shop';

const data = parseGameData(loadRawGameData());

function tileOffers(offers: ReturnType<typeof rollShop>['offers']) {
  return offers.filter((offer) => offer.kind === 'tile');
}

function parseKindN(tileId: TileId): { kind: string; n: number } {
  const [kind, n] = tileId.split(':');
  return { kind: kind!, n: Number(n) };
}

function inTable(visit: ShopFile['shops'][number], tileId: TileId): boolean {
  const { kind, n } = parseKindN(tileId);
  return visit.table.some(
    (entry) => entry.kind === kind && n >= entry.n[0] && n <= entry.n[1],
  );
}

describe('rollShop', () => {
  it('is deterministic: the same (afterWave, rng, data) gives identical offers', () => {
    const state = fakeRunState({ rng: createStreams('same-shop') });
    expect(rollShop(2, state, data)).toEqual(rollShop(2, state, data));
  });

  it('a different seed eventually gives different offers', () => {
    let found = false;
    for (let i = 0; i < 200; i += 1) {
      const a = rollShop(3, fakeRunState({ rng: createStreams(`a-${i}`) }), data);
      const b = rollShop(3, fakeRunState({ rng: createStreams(`b-${i}`) }), data);
      if (JSON.stringify(a.offers) !== JSON.stringify(b.offers)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('honours every wave’s guarantees in the leftmost slot(s) over seeds 1–200', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const state = fakeRunState({ rng: createStreams(`g-${seed}`) });
      for (const visit of data.shop.shops) {
        const { offers } = rollShop(visit.afterWave, state, data);
        visit.guarantees.forEach((guarantee, index) => {
          const offer = offers[index];
          expect(offer?.kind).toBe('tile');
          if (offer?.kind !== 'tile') return;
          if ('tileId' in guarantee) {
            expect(offer.tileId).toBe(guarantee.tileId);
            return;
          }
          const { kind, n } = parseKindN(offer.tileId);
          expect(kind).toBe(guarantee.kind);
          if (guarantee.n) {
            expect(n).toBeGreaterThanOrEqual(guarantee.n[0]);
            expect(n).toBeLessThanOrEqual(guarantee.n[1]);
          }
        });
      }
    }
  });

  it('only rolls tiles inside the wave’s table ranges; after-wave-1 is add:1–add:5', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const state = fakeRunState({ rng: createStreams(`t-${seed}`) });
      for (const visit of data.shop.shops) {
        const { offers } = rollShop(visit.afterWave, state, data);
        for (const offer of tileOffers(offers)) {
          expect(inTable(visit, offer.tileId)).toBe(true);
          if (visit.afterWave === 1) {
            const { kind, n } = parseKindN(offer.tileId);
            expect(kind).toBe('add');
            expect(n).toBeGreaterThanOrEqual(1);
            expect(n).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  });

  it('duplicates happen: some shop rolls the same tile id twice across seeds 1–200', () => {
    let found = false;
    for (let seed = 1; seed <= 200; seed += 1) {
      const state = fakeRunState({ rng: createStreams(`d-${seed}`) });
      for (const visit of data.shop.shops) {
        const ids = tileOffers(rollShop(visit.afterWave, state, data).offers).map(
          (offer) => offer.tileId,
        );
        if (new Set(ids).size < ids.length) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    expect(found).toBe(true);
  });

  it('keeps the cannon slot at maxCannons (available: false) and escalates price below it', () => {
    const max = data.economy.maxCannons;
    const layout = ['tile:0', 'tile:1', 'tile:2', 'cannon', 'upgrade'];

    const fullCannons = Array.from({ length: 5 }, (_, i) => i < max);
    const atCap = fakeRunState({
      rng: createStreams('cannon-cap'),
      board: { cannons: fullCannons, cells: fakeRunState().board.cells, robots: [] },
    });
    const capOffers = rollShop(1, atCap, data).offers;
    expect(capOffers.map((offer) => offer.slot)).toEqual(layout);
    const capCannon = capOffers.find((offer) => offer.slot === 'cannon');
    expect(capCannon).toMatchObject({ kind: 'cannon', bought: false, available: false });

    for (const owned of [1, 2, 3, 4]) {
      const cannons = Array.from({ length: 5 }, (_, i) => i < owned);
      const { offers } = rollShop(
        1,
        fakeRunState({
          rng: createStreams(`cannon-${owned}`),
          board: { cannons, cells: fakeRunState().board.cells, robots: [] },
        }),
        data,
      );
      expect(offers.map((offer) => offer.slot)).toEqual(layout);
      const cannon = offers.find((offer) => offer.slot === 'cannon');
      expect(cannon).toMatchObject({
        kind: 'cannon',
        bought: false,
        available: true,
        price: cannonPrice(owned, data),
      });
    }
  });

  it('upgrade fromValue/toValue follow cannonBaseValue', () => {
    for (const fromValue of [1, 4, 7]) {
      const { offers } = rollShop(
        1,
        fakeRunState({ rng: createStreams('up'), cannonBaseValue: fromValue }),
        data,
      );
      const upgrade = offers.find((offer) => offer.slot === 'upgrade');
      expect(upgrade).toMatchObject({
        kind: 'upgrade',
        bought: false,
        fromValue,
        toValue: fromValue + 1,
      });
    }
  });

  it('advances only the shop stream — the wave stream is untouched', () => {
    const rng = createStreams('iso-shop');
    const state = fakeRunState({ rng });
    const waveBefore = [...state.rng.wave];
    const shopBefore = [...state.rng.shop];
    const result = rollShop(1, state, data);
    expect(state.rng.wave).toEqual(waveBefore);
    expect(state.rng.shop).toEqual(shopBefore);
    expect(result.rng).not.toEqual(shopBefore);
  });

  it('throws a readable error when afterWave has no table', () => {
    expect(() =>
      rollShop(99, fakeRunState({ rng: createStreams('missing') }), data),
    ).toThrow(/afterWave 99/);
  });

  it('draws a { kind, n } guarantee from the intersection, not the table entry’s full range', () => {
    const tiles: GameData['tiles'] = [];
    for (let n = 1; n <= 10; n += 1) {
      tiles.push({
        id: `add:${n}` as TileId,
        kind: 'add',
        n,
        priceCategory: 'add',
        color: 'green',
        starred: false,
      });
    }
    for (let n = 2; n <= 10; n += 1) {
      tiles.push({
        id: `mul:${n}` as TileId,
        kind: 'mul',
        n,
        priceCategory: n <= 5 ? 'mulLow' : 'mulHigh',
        color: 'orange',
        starred: n >= 6,
      });
    }
    const custom = parseGameData({
      ...loadRawGameData(),
      tiles,
      shop: fakeShop({
        shops: [
          {
            afterWave: 1,
            guarantees: [{ kind: 'mul', n: [2, 5] }],
            table: [
              { kind: 'add', n: [1, 10], weight: 1 },
              { kind: 'mul', n: [2, 10], weight: 1 },
            ],
          },
        ],
      }),
      waves: {
        waves: [
          {
            id: 'wave-1',
            spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [1, 1] }],
          },
          {
            id: 'wave-2',
            spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [1, 1] }],
          },
        ],
      },
    });

    for (let seed = 1; seed <= 200; seed += 1) {
      const { offers } = rollShop(
        1,
        fakeRunState({ rng: createStreams(`intersect-${seed}`) }),
        custom,
      );
      const first = offers[0];
      expect(first?.kind).toBe('tile');
      if (first?.kind !== 'tile') continue;
      const { kind, n } = parseKindN(first.tileId);
      expect(kind).toBe('mul');
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('starts every offer unbought, in tile then cannon then upgrade order', () => {
    const { offers } = rollShop(1, fakeRunState({ rng: createStreams('order') }), data);
    expect(offers.every((offer) => offer.bought === false)).toBe(true);
    expect(offers.map((offer) => offer.slot)).toEqual([
      'tile:0',
      'tile:1',
      'tile:2',
      'cannon',
      'upgrade',
    ]);
  });
});
