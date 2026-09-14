import { describe, expect, it } from 'vitest';
import { applyTile } from '../../../sim/core/tiles';
import type { TileDef } from '../../../sim/core/types';

function tile(kind: TileDef['kind'], n: number): TileDef {
  const priceCategory = kind === 'mul' ? (n <= 5 ? 'mulLow' : 'mulHigh') : (kind as 'add' | 'sub');
  return { id: `${kind}:${n}`, kind, n, priceCategory };
}

describe('applyTile', () => {
  it('adds', () => {
    expect(applyTile(5, tile('add', 4))).toBe(9);
  });

  it('subtracts, going negative with no clamping (GDD §2.1)', () => {
    expect(applyTile(3, tile('sub', 7))).toBe(-4);
    expect(applyTile(-4, tile('sub', 2))).toBe(-6);
  });

  it('multiplies, including negative values', () => {
    expect(applyTile(4, tile('mul', 3))).toBe(12);
    expect(applyTile(-2, tile('mul', 3))).toBe(-6);
  });

  it('supports large products with no cap (GDD §2.1)', () => {
    expect(applyTile(1, tile('mul', 10))).toBe(10);
    const chained = [tile('mul', 10), tile('mul', 10), tile('mul', 10), tile('mul', 10)].reduce(
      (value, t) => applyTile(value, t),
      1,
    );
    expect(chained).toBe(10000);
  });

  it('deals with zero and negative starting values without clamping mid-flight', () => {
    expect(applyTile(0, tile('add', 5))).toBe(5);
    expect(applyTile(-1, tile('mul', 5))).toBe(-5);
  });
});
