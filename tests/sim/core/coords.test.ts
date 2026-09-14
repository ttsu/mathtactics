import { describe, expect, it } from 'vitest';
import {
  COLS,
  LANES,
  cellKey,
  cells,
  cols,
  isCannonSlot,
  isCol,
  isLane,
  isTileCell,
  lanes,
  tileCols,
  type Col,
} from '../../../sim/core/coords';

describe('coords', () => {
  it('has a 5×8 board (GDD §3.1)', () => {
    expect(LANES).toBe(5);
    expect(COLS).toBe(8);
  });

  it('treats col 0 as the cannon slot and cols 1..7 as tile cells', () => {
    expect(isCannonSlot(0)).toBe(true);
    expect(isTileCell(0)).toBe(false);
    for (const col of [1, 2, 3, 4, 5, 6, 7] as Col[]) {
      expect(isCannonSlot(col)).toBe(false);
      expect(isTileCell(col)).toBe(true);
    }
  });

  it('validates lane and col ranges', () => {
    expect(isLane(0)).toBe(true);
    expect(isLane(4)).toBe(true);
    expect(isLane(-1)).toBe(false);
    expect(isLane(5)).toBe(false);
    expect(isLane(1.5)).toBe(false);

    expect(isCol(0)).toBe(true);
    expect(isCol(7)).toBe(true);
    expect(isCol(8)).toBe(false);
  });

  it('formats a cell key', () => {
    expect(cellKey({ lane: 2, col: 3 })).toBe('2,3');
  });

  it('enumerates lanes and columns', () => {
    expect(lanes()).toEqual([0, 1, 2, 3, 4]);
    expect(cols()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(tileCols()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('enumerates every cell lane-major', () => {
    const all = cells();
    expect(all).toHaveLength(LANES * COLS);
    expect(all[0]).toEqual({ lane: 0, col: 0 });
    expect(all[COLS - 1]).toEqual({ lane: 0, col: COLS - 1 });
    expect(all[COLS]).toEqual({ lane: 1, col: 0 });
    expect(all[all.length - 1]).toEqual({ lane: LANES - 1, col: COLS - 1 });
  });
});
