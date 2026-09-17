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
/** Empty cannon slots are outlined more heavily so they read as sockets, not cannons. */
export const CANNON_SLOT_OUTLINE_WIDTH = 4;

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

// --- Pieces (task 09) ---

/** Gap between a cell's bounds and the tile / cannon block drawn in it. */
export const PIECE_INSET = 8;
/** On-board tile and cannon block size (a cell minus the inset on both sides). */
export const PIECE_SIZE = CELL_SIZE - PIECE_INSET * 2;
/** Robot block: smaller than a tile so the colour of a tile it stands on still shows around it. */
export const ROBOT_SIZE = 76;
/** Font sizes in design points. Robot HP must be the largest text on the board (GDD §11.2). */
export const TILE_LABEL_FONT_SIZE = 40;
export const ROBOT_HP_FONT_SIZE = 56;
/** Weakness chest numeral — smaller than HP so HP stays the largest number (GDD §6.4, §11.2). */
export const WEAKNESS_N_FONT_SIZE = 22;
/** Horizontal offset of each even-only antenna from centre (design points). Unused on parity
 * robots: their identifying marks are shield dots, not antennae (GDD §6.3 v0.7.1). */
export const ROBOT_ANTENNA_SPREAD = 14;
/** Parity-shield crest dots (GDD §6.3). Radius and spread stay smaller than HP. */
export const SHIELD_DOT_RADIUS = 7;
export const SHIELD_DOT_SPREAD = 11;
/** Drop the HP numeral slightly on a heater shield so the crest dots sit above it. */
export const SHIELD_HP_OFFSET_Y = 12;
/** Floating green pluses on a Bounce-back refill (GDD §6.2). Smaller than HP. */
export const BOUNCE_PLUS_FONT_SIZE = 22;
export const CANNON_VALUE_FONT_SIZE = 26;
export const TILE_STAR_FONT_SIZE = 18;
/** Planning-hint running totals under tiles (task 24). Must stay smaller than the tile numeral. */
export const HINT_FONT_SIZE = 22;
/** Vertical offset from the cell centre down to the hint numeral (overlaps the tile's bottom). */
export const HINT_OFFSET_Y = PIECE_SIZE / 2 - 4;
/** Robot HP bar, drawn just under the robot block (task 10: bounce-back refills it). */
export const HP_BAR_WIDTH = ROBOT_SIZE - 8;
export const HP_BAR_HEIGHT = 8;
export const HP_BAR_GAP = 3;

// --- Playback (task 10) ---

/** The red ball. Its value is the second-largest number on the board, after robot HP. */
export const BALL_RADIUS = 32;
export const BALL_VALUE_FONT_SIZE = 44;
/** Damage numbers flying off a robot, and coin rewards floating up. */
export const DAMAGE_FONT_SIZE = 40;
export const COIN_FONT_SIZE = 36;
/** Where a ball stops when it hits a robot: this far left of the robot cell's centre. */
export const BALL_IMPACT_OFFSET = CELL_SIZE / 2 - BALL_RADIUS / 2;
/** Outline drawn around the active lane during playback. */
export const LANE_HIGHLIGHT_WIDTH = 6;
/** Ring outlines for kill puffs, the exact-kill shock ring and the blocked-hit shield. */
export const PUFF_RING_WIDTH = 4;
export const BURST_RING_WIDTH = 8;
/** Exact-kill star sizes (outer radius). */
export const BURST_STAR_RADIUS = 16;
export const BIG_STAR_RADIUS = 44;
/** Sparks thrown off a ball passing through a × tile. */
export const SPARK_STAR_RADIUS = 11;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

// --- Base strip / waiting ghosts (task 15) ---

/** Design-space rect of one lane's base strip cell — a robot has no `col` there (it's left of
 * column 0), so this doesn't come from `cellRect`. */
export function baseStripRect(lane: number): Rect {
  return {
    x: BASE_STRIP.x,
    y: BASE_STRIP.y + lane * CELL_SIZE,
    width: BASE_STRIP.width,
    height: CELL_SIZE,
  };
}

/** Design-space centre of one lane's base strip cell — where a detonating robot lurches to and
 * flashes (GDD §7.2, §12.2 step 5). */
export function baseStripCenter(lane: number): Point {
  return rectCenter(baseStripRect(lane));
}

/** Design-space centre of a waiting robot's ghost — one cell right of column 7, still inside the
 * board's right margin (GDD §12.2 step 6: "just right of column 7"). */
export function waitingGhostCenter(lane: number): Point {
  const col7 = cellCenter(lane, COLUMN_COUNT - 1);
  return { x: col7.x + CELL_SIZE, y: col7.y };
}

export function rectContains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

/** Design-space centre of a grid cell. */
export function cellCenter(lane: number, col: number): Point {
  return rectCenter(cellRect(lane, col));
}

/** The grid cell containing a design point, or `null` outside the grid. */
export function cellAtPoint(point: Point): { lane: number; col: number } | null {
  if (!rectContains(GRID, point)) return null;
  return {
    lane: Math.floor((point.y - GRID.y) / CELL_SIZE),
    col: Math.floor((point.x - GRID.x) / CELL_SIZE),
  };
}

/** The grid cell whose drawn face (its rect inset by `CELL_INSET`) contains a design point, or
 * `null` — outside the grid, or in the thin visual gutter between two cells. */
export function cellFaceAtPoint(point: Point): { lane: number; col: number } | null {
  const cell = cellAtPoint(point);
  if (cell === null) return null;
  const rect = cellRect(cell.lane, cell.col);
  const face = {
    x: rect.x + CELL_INSET,
    y: rect.y + CELL_INSET,
    width: rect.width - CELL_INSET * 2,
    height: rect.height - CELL_INSET * 2,
  };
  return rectContains(face, point) ? cell : null;
}

// --- Tray slots (task 09, GDD §9.3) ---
// The tray is one horizontal row of fixed slots. With more pieces than slots it scrolls a whole
// slot at a time (see ./trayScroll), so a piece is always either fully shown or hidden.

/** Pieces visible at once (task 09: ≥ 12 visible at 60pt+). */
export const TRAY_CAPACITY = 12;
/** Size a tile is drawn at in the tray (≥ 60pt touch target, GDD §3.2). */
export const TRAY_TILE_SIZE = 64;
/** Horizontal distance between tray slot centres; each slot's touch area is pitch × tray height. */
export const TRAY_SLOT_PITCH = 70;
/** Space either side of the slot row (holds the "more this way" markers when the tray scrolls). */
export const TRAY_PADDING = (TRAY.width - TRAY_CAPACITY * TRAY_SLOT_PITCH) / 2;

/** Centre of the tray slot showing piece `index` when the tray is scrolled by `scroll` slots. */
export function traySlotCenter(index: number, scroll: number): Point {
  return {
    x: TRAY.x + TRAY_PADDING + (index - scroll) * TRAY_SLOT_PITCH + TRAY_SLOT_PITCH / 2,
    y: TRAY.y + TRAY.height / 2,
  };
}

/** The visible slot (0..TRAY_CAPACITY-1) under a design point, or `null` if the point is outside
 * the tray or in its side padding. */
export function traySlotAtPoint(point: Point): number | null {
  if (!rectContains(TRAY, point)) return null;
  const slot = Math.floor((point.x - TRAY.x - TRAY_PADDING) / TRAY_SLOT_PITCH);
  return slot >= 0 && slot < TRAY_CAPACITY ? slot : null;
}

// --- Client coordinates (test handle, TR §14) ---

/** Client (CSS px) position of a design point, given the displayed canvas's client rect. */
export function designToClient(
  canvas: Pick<DOMRectReadOnly, 'left' | 'top' | 'width'>,
  point: Point,
): Point {
  const scale = canvas.width / DESIGN_WIDTH;
  return { x: canvas.left + point.x * scale, y: canvas.top + point.y * scale };
}

/** Client (CSS px) position of a cell's centre, given the displayed canvas's client rect. */
export function cellToClient(
  canvas: Pick<DOMRectReadOnly, 'left' | 'top' | 'width'>,
  cell: { lane: number; col: number },
): Point {
  return designToClient(canvas, cellCenter(cell.lane, cell.col));
}
