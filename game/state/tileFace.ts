// Framework-free tile face (task 20): operator glyph, operand, category colour key, and the
// ×6+ star. `/game/board` and `/game/ui` both render from this so chips don't drift. Callers
// resolve `colorKey` through `presentation.json` `tileColors` — this module does not read
// presentation (GDD §9.1, CLAUDE.md rule 7).

import type { TileId, TileKind } from '../../sim/core/types';

export type TileColorKey = 'green' | 'blue' | 'orange';

export interface TileFace {
  glyph: '+' | '−' | '×';
  n: number;
  colorKey: TileColorKey;
  starred: boolean;
}

const GLYPH: Record<TileKind, TileFace['glyph']> = {
  add: '+',
  sub: '−',
  mul: '×',
};

const COLOR_KEY: Record<TileKind, TileColorKey> = {
  add: 'green',
  sub: 'blue',
  mul: 'orange',
};

/** Face of a tile id (`"add:4"` → `{ glyph: '+', n: 4, colorKey: 'green', starred: false }`). */
export function tileFace(tileId: TileId): TileFace {
  const [kind, nText] = tileId.split(':') as [TileKind, string];
  const n = Number(nText);
  return {
    glyph: GLYPH[kind],
    n,
    colorKey: COLOR_KEY[kind],
    starred: kind === 'mul' && n >= 6,
  };
}
