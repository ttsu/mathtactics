// Rolls one shop visit's offers (GDD §8.5, TR §9). Pure: draws only from the `shop` stream.
//
// Draw order is normative so saves and scenarios reproduce exactly:
//   1. Guaranteed tile slots, left to right, filling `tile:0` onward.
//   2. Remaining tile slots, left to right: `pickWeighted` over the whole table, then `nextInt`
//      over that entry's `n` range inclusive.
//   3. The cannon and upgrade offers are computed, never drawn.
//
// Guarantee matching:
//   - `{ tileId }` — emit that tile; consume no randomness.
//   - `{ kind }` — `pickWeighted` over table entries of that kind, then `nextInt` over the
//     entry's full `n` range.
//   - `{ kind, n: [lo, hi] }` — `pickWeighted` over overlapping entries of that kind, then
//     `nextInt` over the intersection of the entry's range and `[lo, hi]`.
//
// `afterWave` is 1-based: the wave just cleared (`= waveIndex + 1`). Every other wave
// reference in the codebase is 0-based; callers convert at the boundary.

import { nextInt, pickWeighted, type RngState } from '../core/rng';
import type { RunState, ShopOffer, TileId, TileKind } from '../core/types';
import type { GameData, ShopFile } from '../data/schemas';
import { cannonPrice, tilePrice, upgradePrice } from './pricing';

type ShopVisit = ShopFile['shops'][number];
type ShopTableEntry = ShopVisit['table'][number];
type ShopGuarantee = ShopVisit['guarantees'][number];

export interface RolledShop {
  offers: ShopOffer[];
  rng: RngState;
}

function rangesOverlap(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

function weightedEntries(entries: ShopTableEntry[]): { item: ShopTableEntry; weight: number }[] {
  return entries.map((entry) => ({ item: entry, weight: entry.weight }));
}

function drawN(
  rng: RngState,
  kind: TileKind,
  lo: number,
  hi: number,
  data: GameData,
): { tileId: TileId; price: number; rng: RngState } {
  const [n, next] = nextInt(rng, lo, hi);
  const tileId = `${kind}:${n}` as TileId;
  return { tileId, price: tilePrice(tileId, data), rng: next };
}

function drawFromTable(
  rng: RngState,
  table: ShopTableEntry[],
  data: GameData,
): { tileId: TileId; price: number; rng: RngState } {
  const [entry, afterPick] = pickWeighted(rng, weightedEntries(table));
  return drawN(afterPick, entry.kind, entry.n[0], entry.n[1], data);
}

function drawGuarantee(
  rng: RngState,
  guarantee: ShopGuarantee,
  table: ShopTableEntry[],
  data: GameData,
  afterWave: number,
): { tileId: TileId; price: number; rng: RngState } {
  if ('tileId' in guarantee) {
    return { tileId: guarantee.tileId, price: tilePrice(guarantee.tileId, data), rng };
  }

  const candidates = table.filter((entry) => {
    if (entry.kind !== guarantee.kind) return false;
    if (!guarantee.n) return true;
    return rangesOverlap(entry.n, guarantee.n);
  });
  if (candidates.length === 0) {
    throw new Error(
      `rollShop: guarantee is not satisfiable for afterWave ${afterWave}`,
    );
  }
  const [entry, afterPick] = pickWeighted(rng, weightedEntries(candidates));
  const lo = guarantee.n ? Math.max(entry.n[0], guarantee.n[0]) : entry.n[0];
  const hi = guarantee.n ? Math.min(entry.n[1], guarantee.n[1]) : entry.n[1];
  return drawN(afterPick, entry.kind, lo, hi, data);
}

export function rollShop(afterWave: number, runState: RunState, data: GameData): RolledShop {
  const visit = data.shop.shops.find((shop) => shop.afterWave === afterWave);
  if (!visit) {
    throw new Error(`rollShop: no shop table for afterWave ${afterWave}`);
  }

  let rng = runState.rng.shop;
  const offers: ShopOffer[] = [];

  for (let slot = 0; slot < data.shop.tileSlots; slot += 1) {
    const guarantee = visit.guarantees[slot];
    const drawn = guarantee
      ? drawGuarantee(rng, guarantee, visit.table, data, afterWave)
      : drawFromTable(rng, visit.table, data);
    rng = drawn.rng;
    offers.push({
      slot: `tile:${slot}`,
      kind: 'tile',
      tileId: drawn.tileId,
      price: drawn.price,
      bought: false,
    });
  }

  const cannonsOwned = runState.board.cannons.filter(Boolean).length;
  offers.push({
    slot: 'cannon',
    kind: 'cannon',
    price: cannonPrice(cannonsOwned, data),
    bought: false,
    available: cannonsOwned < data.economy.maxCannons,
  });

  offers.push({
    slot: 'upgrade',
    kind: 'upgrade',
    price: upgradePrice(runState.upgradesBought, data),
    bought: false,
    fromValue: runState.cannonBaseValue,
    toValue: runState.cannonBaseValue + 1,
  });

  return { offers, rng };
}
