// Static board geometry (GDD §3.1–3.2, TR §11.2). The single source of truth for where things
// sit on the board. Layout is code (geometry), not tuning — but every board position must be
// derived from the constants in this module, never typed into a scene.
//
// All values are design points (1pt = 1 CSS px at the 1180×820 design size). Phaser draws in
// world pixels: convert with `designToWorld()` at the point of drawing.
//
// Kept free of Phaser imports so it is unit-testable in node.

import { COLS, LANES } from '../../sim/core/coords';
import { DESIGN_HEIGHT, DESIGN_WIDTH, HUD_BAR, type Rect } from '../state/designSpace';

/**
 * World pixels per design point. The Phaser game is sized at design × UNIT (2360×1640) and
 * scaled to fit with CSS, so at the design size one world pixel is one device pixel on a 2×
 * display and Phaser Text rasterises crisply without per-object `resolution` (TR §11.2).
 */
export const UNIT = 2;

export const WORLD_WIDTH = DESIGN_WIDTH * UNIT;
export const WORLD_HEIGHT = DESIGN_HEIGHT * UNIT;

export function designToWorld(points: number): number {
  return points * UNIT;
}

export function worldToDesign(pixels: number): number {
  return pixels / UNIT;
}

// Board dimensions come from /sim/core/coords (TR §3: they're a design constant, not tuning),
// re-exported under these names since they're layout-facing (cell counts), not sim state.
export const LANE_COUNT = LANES;
export const COLUMN_COUNT = COLS; // col 0 = cannon slot, cols 1–7 = tile cells

export const CELL_SIZE = 100;
export const BASE_STRIP_WIDTH = 80;
export const TRAY_GAP = 20;
export const TRAY_HEIGHT = 120;
/** Placeholder drawing: gap between a cell's bounds and its drawn shape, corner radius, outline. */
export const CELL_INSET = 4;
export const CORNER_RADIUS = 10;
export const CELL_OUTLINE_WIDTH = 2;
/** Font size of the crispness test label (task 03 req. 4). */
export const TEST_LABEL_FONT_SIZE = 48;

const GRID_WIDTH = COLUMN_COUNT * CELL_SIZE;
const GRID_HEIGHT = LANE_COUNT * CELL_SIZE;
const BOARD_WIDTH = BASE_STRIP_WIDTH + GRID_WIDTH;
const BOARD_HEIGHT = GRID_HEIGHT + TRAY_GAP + TRAY_HEIGHT;

/** Everything below the React HUD bar. */
export const BOARD_AREA: Rect = {
  x: 0,
  y: HUD_BAR.y + HUD_BAR.height,
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT - (HUD_BAR.y + HUD_BAR.height),
};

// The board (base strip + grid + tray) is centred inside the board area.
const BOARD_LEFT = BOARD_AREA.x + (BOARD_AREA.width - BOARD_WIDTH) / 2;
const BOARD_TOP = BOARD_AREA.y + (BOARD_AREA.height - BOARD_HEIGHT) / 2;

/** Base strip, left of the cannon slot column, spanning all lanes. */
export const BASE_STRIP: Rect = {
  x: BOARD_LEFT,
  y: BOARD_TOP,
  width: BASE_STRIP_WIDTH,
  height: GRID_HEIGHT,
};

/** The full 5×8 grid: cannon slot column (col 0) plus tile cells (cols 1–7). */
export const GRID: Rect = {
  x: BOARD_LEFT + BASE_STRIP_WIDTH,
  y: BOARD_TOP,
  width: GRID_WIDTH,
  height: GRID_HEIGHT,
};

/** Tray strip below the grid, spanning the base strip and grid. */
export const TRAY: Rect = {
  x: BOARD_LEFT,
  y: BOARD_TOP + GRID_HEIGHT + TRAY_GAP,
  width: BOARD_WIDTH,
  height: TRAY_HEIGHT,
};

/** Design-space rect of one grid cell. Lane 0 is the top lane; col 0 is the cannon slot. */
export function cellRect(lane: number, col: number): Rect {
  if (!Number.isInteger(lane) || lane < 0 || lane >= LANE_COUNT) {
    throw new RangeError(`lane out of range: ${lane}`);
  }
  if (!Number.isInteger(col) || col < 0 || col >= COLUMN_COUNT) {
    throw new RangeError(`col out of range: ${col}`);
  }
  return {
    x: GRID.x + col * CELL_SIZE,
    y: GRID.y + lane * CELL_SIZE,
    width: CELL_SIZE,
    height: CELL_SIZE,
  };
}
