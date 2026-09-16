// The `shop.json` block (task 18) for hand-built fake `GameData` fixtures — one copy, so a new
// shop field is added in one place (same pattern as `fakeScreenSettings`).
//
// A one-wave fixture may use `shops: []` (no non-final wave, so coverage is vacuously satisfied).

import type { ShopFile } from '../../sim/data/schemas';

export function fakeShop(overrides: Partial<ShopFile> = {}): ShopFile {
  return {
    tileSlots: 3,
    prices: { add: 4, sub: 4, mulLow: 6, mulHigh: 9 },
    cannon: { base: 10, step: 5 },
    upgrade: { base: 12, step: 6 },
    shops: [],
    ...overrides,
  };
}
