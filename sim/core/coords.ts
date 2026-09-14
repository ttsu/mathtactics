// Board coordinates (GDD §3.1, TR §3). `LANES` and `COLS` are design constants, not tuning
// data — changing them is a design change, not a data edit (TR §3). This module has no
// behavior beyond tiny pure helpers (CLAUDE.md rule 1 / task 04 scope).

/** Number of lanes, indexed 0 (top) .. LANES-1 (bottom). GDD §3.1. */
export const LANES = 5;

/** Number of columns. Column 0 is the cannon slot; columns 1..COLS-1 are tile cells. */
export const COLS = 8;

export type Lane = 0 | 1 | 2 | 3 | 4;
export type Col = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Cell {
  lane: Lane;
  col: Col;
}

export function isLane(value: number): value is Lane {
  return Number.isInteger(value) && value >= 0 && value < LANES;
}

export function isCol(value: number): value is Col {
  return Number.isInteger(value) && value >= 0 && value < COLS;
}

/** Column 0 holds the cannon; robots never enter it (GDD §3.1). */
export function isCannonSlot(col: Col): boolean {
  return col === 0;
}

/** Columns 1..COLS-1 may hold a tile (GDD §3.1). */
export function isTileCell(col: Col): boolean {
  return col > 0;
}

export function cellKey(cell: Cell): string {
  return `${cell.lane},${cell.col}`;
}

/** All lane indices, top to bottom. */
export function lanes(): Lane[] {
  return [0, 1, 2, 3, 4];
}

/** All column indices, including the col 0 cannon slot. */
export function cols(): Col[] {
  return [0, 1, 2, 3, 4, 5, 6, 7];
}

/** Tile-cell columns only (1..COLS-1), left to right. */
export function tileCols(): Col[] {
  return cols().filter(isTileCell) as Col[];
}

/** Every cell on the board, lane-major (all of lane 0 left-to-right, then lane 1, ...). */
export function cells(): Cell[] {
  const result: Cell[] = [];
  for (const lane of lanes()) {
    for (const col of cols()) {
      result.push({ lane, col });
    }
  }
  return result;
}
