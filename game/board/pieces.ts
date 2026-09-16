// Read-only views of a `RunState` shaped for the board renderer (task 09): where every tile piece
// lives, what a tile's label says, and which parts of the state the board actually draws.
// Phaser-free so it is unit-testable in node.

import type { Cell } from '../../sim/core/coords';
import type { RunState, TileId } from '../../sim/core/types';
import type { GameData } from '../../sim/data/schemas';
import { tileFace } from '../state/tileFace';

export type PieceHome = { kind: 'cell'; cell: Cell } | { kind: 'tray'; index: number };

/** Where every owned tile piece sits: on a cell, or at an index in the tray. */
export function pieceHomes(run: RunState): Map<string, PieceHome> {
  const homes = new Map<string, PieceHome>();
  run.board.cells.forEach((row, lane) => {
    row.forEach((pieceId, col) => {
      if (pieceId !== null) {
        homes.set(pieceId, { kind: 'cell', cell: { lane, col } as Cell });
      }
    });
  });
  run.tray.forEach((pieceId, index) => {
    homes.set(pieceId, { kind: 'tray', index });
  });
  return homes;
}

/** A number as the board shows it, with a real minus sign for negatives (`"−3"`) to match tile
 * labels — for ball values and robot HP. */
export function formatNumber(value: number): string {
  return value < 0 ? `−${-value}` : String(value);
}

/** Tile face text with the real `−` and `×` glyphs (task 09 req. 2), e.g. `"+4"`, `"−2"`, `"×3"`. */
export function tileLabel(tileId: TileId): string {
  const face = tileFace(tileId);
  return `${face.glyph}${face.n}`;
}

/** True when anything the board draws differs between two states (task 09 req. 1: `run.board`,
 * `run.tray`, `run.cannonBaseValue`; plus `run.pieces`, since a newly installed run may reuse a
 * `pieceId` for a different tile). Relies on commands returning new objects for changed parts. */
export function boardSliceChanged(prev: RunState | null, next: RunState | null): boolean {
  if (prev === next) return false;
  if (prev === null || next === null) return true;
  return (
    prev.board !== next.board ||
    prev.tray !== next.tray ||
    prev.pieces !== next.pieces ||
    prev.cannonBaseValue !== next.cannonBaseValue
  );
}

/** A tile's face colour from data: `tiles.json` names the colour, `presentation.json` maps it to
 * a CSS hex string (GDD §9.1, §13). */
export function tileColor(
  tileId: TileId,
  data: Pick<GameData, 'tiles' | 'presentation'>,
): { hex: string; starred: boolean } {
  const def = data.tiles.find((tile) => tile.id === tileId);
  if (!def) throw new Error(`unknown tile id "${tileId}"`);
  const { colorKey, starred } = tileFace(tileId);
  const hex = data.presentation.tileColors[colorKey];
  if (!hex) throw new Error(`no presentation colour for "${colorKey}"`);
  return { hex, starred };
}
