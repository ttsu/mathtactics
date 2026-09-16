// Shop prices (GDD §8.4, TR §9). Pure: every number comes from `shop.json` (CLAUDE.md rule 3).

import type { TileId } from '../core/types';
import type { GameData } from '../data/schemas';

/** Price of a tile by its `priceCategory`, not by N (GDD §8.4). */
export function tilePrice(tileId: TileId, data: GameData): number {
  const tile = data.tiles.find((entry) => entry.id === tileId);
  if (!tile) {
    throw new Error(`tilePrice: unknown tile "${tileId}"`);
  }
  return data.shop.prices[tile.priceCategory];
}

/** `cannon.base + cannon.step × (cannonsOwned − 1)` — 10 with one cannon owned, +5 beyond the first. */
export function cannonPrice(cannonsOwned: number, data: GameData): number {
  const { base, step } = data.shop.cannon;
  return base + step * (cannonsOwned - 1);
}

/** `upgrade.base + upgrade.step × upgradesBought` — 12 for the first upgrade. */
export function upgradePrice(upgradesBought: number, data: GameData): number {
  const { base, step } = data.shop.upgrade;
  return base + step * upgradesBought;
}
