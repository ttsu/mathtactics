import { describe, expect, it } from 'vitest';
import {
  BASE_STRIP,
  BOARD_AREA,
  CELL_SIZE,
  COLUMN_COUNT,
  GRID,
  LANE_COUNT,
  TRAY,
  UNIT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  cellRect,
  designToWorld,
  worldToDesign,
} from '../../game/board/layout';
import { DESIGN_HEIGHT, DESIGN_WIDTH, HUD_BAR, type Rect } from '../../game/state/designSpace';

const right = (r: Rect) => r.x + r.width;
const bottom = (r: Rect) => r.y + r.height;
const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  right(inner) <= right(outer) &&
  bottom(inner) <= bottom(outer);

describe('design ↔ world units', () => {
  it('world is design space × UNIT (2360×1640)', () => {
    expect(UNIT).toBe(2);
    expect(WORLD_WIDTH).toBe(2360);
    expect(WORLD_HEIGHT).toBe(1640);
  });

  it('designToWorld and worldToDesign are inverses', () => {
    expect(designToWorld(48)).toBe(96);
    expect(worldToDesign(96)).toBe(48);
    for (const value of [0, 1, 99.5, 1180]) {
      expect(worldToDesign(designToWorld(value))).toBe(value);
    }
  });
});

describe('board layout', () => {
  it('uses ~100pt cells on a 5×8 grid', () => {
    expect(CELL_SIZE).toBe(100);
    expect(GRID.width).toBe(COLUMN_COUNT * CELL_SIZE);
    expect(GRID.height).toBe(LANE_COUNT * CELL_SIZE);
  });

  it('keeps the board below the HUD bar and inside the design space', () => {
    const designSpace = { x: 0, y: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT };
    expect(BOARD_AREA.y).toBe(bottom(HUD_BAR));
    expect(contains(designSpace, BOARD_AREA)).toBe(true);
    for (const rect of [BASE_STRIP, GRID, TRAY]) {
      expect(contains(BOARD_AREA, rect)).toBe(true);
    }
  });

  it('puts the base strip left of the grid, spanning all lanes, and the tray below', () => {
    expect(right(BASE_STRIP)).toBe(GRID.x);
    expect(BASE_STRIP.y).toBe(GRID.y);
    expect(BASE_STRIP.height).toBe(GRID.height);
    expect(TRAY.y).toBeGreaterThan(bottom(GRID));
    expect(TRAY.x).toBe(BASE_STRIP.x);
    expect(right(TRAY)).toBe(right(GRID));
  });

  it('centres the board horizontally', () => {
    expect(BASE_STRIP.x - BOARD_AREA.x).toBe(right(BOARD_AREA) - right(GRID));
  });

  it('maps cells top-to-bottom by lane and left-to-right by col', () => {
    expect(cellRect(0, 0)).toEqual({ x: GRID.x, y: GRID.y, width: CELL_SIZE, height: CELL_SIZE });
    const last = cellRect(LANE_COUNT - 1, COLUMN_COUNT - 1);
    expect(right(last)).toBe(right(GRID));
    expect(bottom(last)).toBe(bottom(GRID));
    expect(cellRect(2, 3)).toMatchObject({ x: GRID.x + 300, y: GRID.y + 200 });
  });

  it('rejects out-of-range cells', () => {
    expect(() => cellRect(-1, 0)).toThrow(RangeError);
    expect(() => cellRect(LANE_COUNT, 0)).toThrow(RangeError);
    expect(() => cellRect(0, COLUMN_COUNT)).toThrow(RangeError);
    expect(() => cellRect(0.5, 0)).toThrow(RangeError);
  });
});
