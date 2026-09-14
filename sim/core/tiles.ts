// Tile transforms (GDD §5.3, §9.2). Pure, single implementation so FIRE resolution and
// planning hints (GDD §5.7) can share it.

import type { TileDef } from './types';

/**
 * Applies one tile's transform to a ball's current value. No clamping: negative results and
 * arbitrarily large products are legal (GDD §2.1) — this function never limits its output.
 */
export function applyTile(value: number, tileDef: TileDef): number {
  switch (tileDef.kind) {
    case 'add':
      return value + tileDef.n;
    case 'sub':
      return value - tileDef.n;
    case 'mul':
      return value * tileDef.n;
  }
}
