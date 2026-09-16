import { describe, expect, it } from 'vitest';
import { tileFace } from '../../game/state/tileFace';
import { tileColor, tileLabel } from '../../game/board/pieces';
import { realData } from './boardFixtures';

describe('tileFace', () => {
  it('covers all 29 v1 tiles with GDD §9.1 glyphs, colours, and stars', () => {
    expect(realData.tiles).toHaveLength(29);
    for (const tile of realData.tiles) {
      const face = tileFace(tile.id);
      expect(face.n).toBe(tile.n);
      if (tile.kind === 'add') {
        expect(face.glyph).toBe('+');
        expect(face.colorKey).toBe('green');
        expect(face.starred).toBe(false);
      } else if (tile.kind === 'sub') {
        expect(face.glyph).toBe('−');
        expect(face.colorKey).toBe('blue');
        expect(face.starred).toBe(false);
      } else {
        expect(face.glyph).toBe('×');
        expect(face.colorKey).toBe('orange');
        expect(face.starred).toBe(tile.n >= 6);
      }
      expect(face.starred).toBe(tile.starred);
      expect(tileLabel(tile.id)).toBe(`${face.glyph}${face.n}`);
      const color = tileColor(tile.id, realData);
      expect(color.hex).toBe(realData.presentation.tileColors[face.colorKey]);
      expect(color.starred).toBe(face.starred);
    }
  });

  it('uses U+2212 minus and U+00D7 times', () => {
    expect(tileFace('sub:1').glyph).toBe('\u2212');
    expect(tileFace('mul:2').glyph).toBe('\u00d7');
  });
});
