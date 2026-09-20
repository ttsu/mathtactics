// Main-menu title entrance (MATH VS ROBOTS). React-free so letter faces and stagger delays
// are unit-testable. Presentation only: never changes an outcome. Timing lives in
// `presentation.json` `screens`.

import type { TileColorKey } from '../state/tileFace';

export const TITLE_MATH = ['M', 'A', 'T', 'H'] as const;
export const TITLE_ROBOTS = ['R', 'O', 'B', 'O', 'T', 'S'] as const;
export const TITLE_VS = 'VS';
export const TITLE_NAME = 'MATH VS ROBOTS';

const TITLE_TILE_GLYPHS = ['+', '×', '−', '+'] as const;
const TITLE_TILE_COLORS: readonly TileColorKey[] = ['green', 'orange', 'blue', 'green'];

export interface TitleTileFace {
  readonly letter: (typeof TITLE_MATH)[number];
  readonly glyph: (typeof TITLE_TILE_GLYPHS)[number];
  readonly colorKey: TileColorKey;
}

/** Number-tile face for one MATH letter: operator stays, the letter sits where the numeral would. */
export function titleTileFace(index: number): TitleTileFace {
  const letter = TITLE_MATH[index];
  const glyph = TITLE_TILE_GLYPHS[index];
  const colorKey = TITLE_TILE_COLORS[index];
  if (letter === undefined || glyph === undefined || colorKey === undefined) {
    throw new Error(`title tile index ${index} is out of range`);
  }
  return { letter, glyph, colorKey };
}

/** VS slams at delay 0. Letters plop after `plopDelayMs`, then one-by-one by `letterStaggerMs`
 * across MATH and then ROBOTS (pass `TITLE_MATH.length + index` for a robot). */
export function titleLetterPlopDelayMs(
  index: number,
  plopDelayMs: number,
  letterStaggerMs: number,
): number {
  return plopDelayMs + index * letterStaggerMs;
}
