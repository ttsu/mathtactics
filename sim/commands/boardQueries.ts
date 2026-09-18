// Small read-only helpers over `Board` shared by every planning command (GDD §3.3–3.4).

import type { Cell } from '../core/coords';
import { robotOccupies } from '../core/footprint';
import type { Board, Robot } from '../core/types';

/** The `pieceId` occupying `cell`, or `null` if the cell has no tile. */
export function tileAt(board: Board, cell: Cell): string | null {
  return (board.cells[cell.lane] ?? [])[cell.col] ?? null;
}

/** The on-board robot standing in `cell`, if any. A Boss occupies a 2×2, so a cell in its
 * lower or back square still matches. Off-board (waiting) robots have `col: null` and never
 * match a real `Cell`, so this only ever finds robots that lock the cell (GDD §3.4). */
export function robotAt(board: Board, cell: Cell): Robot | undefined {
  return board.robots.find((robot) => robotOccupies(robot, cell));
}
