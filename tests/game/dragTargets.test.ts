import { describe, expect, it } from 'vitest';
import {
  heldPieceCenter,
  pickUpAt,
  resolveDrop,
  type DragSource,
} from '../../game/board/dragTargets';
import {
  CELL_INSET,
  CELL_SIZE,
  GRID,
  TRAY,
  cellCenter,
  traySlotCenter,
} from '../../game/board/layout';
import type { Cell } from '../../sim/core/coords';
import { boardState } from './boardFixtures';

// Lane 0: tile on (0,1), robot locks (0,5) standing on a ×3 tile. Lane 1: cannon + tile on (1,1).
// Lane 2: robot locks (2,4), tile occupies (2,6) — the cells above both, (1,4) and (1,6), are empty.
const run = boardState(
  [
    '. +5 . . . R7[x3] . .',
    'C +2 . . . . . .',
    '. . . . R9 . -2 .',
    'C . . . . . . .',
    '. . . . . . . .',
  ],
  ['add:4', 'mul:3', 'sub:2'],
);
const SNAP = 0.75;
const at = (lane: number, col: number) => cellCenter(lane, col);
const cell = (lane: number, col: number) => ({ lane, col }) as Cell;
const trayPiece = (index: number): DragSource => ({
  kind: 'trayTile',
  pieceId: run.tray[index]!,
  index,
});
const cellPiece = (lane: number, col: number): DragSource => ({
  kind: 'cellTile',
  pieceId: run.board.cells[lane]![col]!,
  from: cell(lane, col),
});

describe('pickUpAt', () => {
  it('picks up tray tiles by visible slot, honouring the scroll offset', () => {
    expect(pickUpAt(traySlotCenter(1, 0), run, 0)).toEqual(trayPiece(1));
    expect(pickUpAt(traySlotCenter(2, 1), run, 1)).toEqual(trayPiece(2));
    expect(pickUpAt(traySlotCenter(5, 0), run, 0)).toBeNull(); // empty slot
  });

  it('picks up cell tiles and cannons, anywhere inside their cell', () => {
    const corner = { x: at(1, 1).x + CELL_SIZE / 2 - 1, y: at(1, 1).y - CELL_SIZE / 2 + 1 };
    expect(pickUpAt(corner, run, 0)).toEqual(cellPiece(1, 1));
    expect(pickUpAt(at(1, 0), run, 0)).toEqual({ kind: 'cannon', lane: 1 });
  });

  it('picks up nothing from an empty cell, an empty cannon slot, or a locked cell', () => {
    expect(pickUpAt(at(2, 3), run, 0)).toBeNull();
    expect(pickUpAt(at(0, 0), run, 0)).toBeNull();
    expect(pickUpAt(at(0, 5), run, 0)).toBeNull(); // tile under a robot (GDD §3.4)
    expect(pickUpAt({ x: 0, y: 0 }, run, 0)).toBeNull();
  });
});

describe('resolveDrop', () => {
  it('tray tile → empty cell is placeTile', () => {
    expect(resolveDrop(trayPiece(0), at(2, 3), run, SNAP)).toEqual({
      kind: 'command',
      command: { type: 'placeTile', pieceId: run.tray[0], to: cell(2, 3) },
      target: { kind: 'cell', cell: cell(2, 3) },
    });
  });

  it('cell tile → another cell is moveTile; back onto its own cell is nothing', () => {
    expect(resolveDrop(cellPiece(1, 1), at(4, 7), run, SNAP)).toMatchObject({
      kind: 'command',
      command: { type: 'moveTile', from: cell(1, 1), to: cell(4, 7) },
    });
    expect(resolveDrop(cellPiece(1, 1), at(1, 1), run, SNAP)).toEqual({
      kind: 'origin',
      target: { kind: 'cell', cell: cell(1, 1) },
    });
  });

  it('cell tile → tray area is returnTile; tray tile → tray is nothing', () => {
    const inTray = { x: TRAY.x + 10, y: TRAY.y + 10 };
    expect(resolveDrop(cellPiece(0, 1), inTray, run, SNAP)).toEqual({
      kind: 'command',
      command: { type: 'returnTile', from: cell(0, 1) },
      target: { kind: 'tray' },
    });
    expect(resolveDrop(trayPiece(2), inTray, run, SNAP)).toEqual({
      kind: 'origin',
      target: { kind: 'tray' },
    });
  });

  it('cannon → empty slot is moveCannon; occupied slot, own slot and tray are not', () => {
    const cannon: DragSource = { kind: 'cannon', lane: 1 };
    expect(resolveDrop(cannon, at(4, 0), run, SNAP)).toMatchObject({
      kind: 'command',
      command: { type: 'moveCannon', fromLane: 1, toLane: 4 },
    });
    expect(resolveDrop(cannon, at(1, 0), run, SNAP).kind).toBe('origin');
    // Lane 3's slot is taken and lanes 2/4 are a whole cell away.
    expect(resolveDrop(cannon, at(3, 0), run, SNAP)).toEqual({
      kind: 'invalid',
      hovered: cell(3, 0),
    });
    expect(resolveDrop(cannon, traySlotCenter(0, 0), run, SNAP)).toEqual({
      kind: 'invalid',
      hovered: null,
    });
    // A cannon never lands in a tile cell.
    expect(resolveDrop(cannon, at(2, 3), run, SNAP).kind).toBe('invalid');
  });

  it('the cell under the finger alone decides: a blocked cell is invalid, never re-routed', () => {
    // Dead centre on the locked (2,4): invalid, even though (1,4) above is empty.
    expect(resolveDrop(trayPiece(0), at(2, 4), run, SNAP)).toEqual({
      kind: 'invalid',
      hovered: cell(2, 4),
    });
    // Occupied (2,6), with (1,6) empty above.
    expect(resolveDrop(trayPiece(0), at(2, 6), run, SNAP)).toEqual({
      kind: 'invalid',
      hovered: cell(2, 6),
    });
    // Anywhere on a blocked cell's face, including right by its edge.
    const edge = { x: at(2, 4).x, y: at(2, 4).y - CELL_SIZE / 2 + CELL_INSET + 1 };
    expect(resolveDrop(trayPiece(0), edge, run, SNAP)).toEqual({
      kind: 'invalid',
      hovered: cell(2, 4),
    });
    // Tiles never go into the cannon slot column.
    expect(resolveDrop(trayPiece(0), at(2, 0), run, SNAP)).toEqual({
      kind: 'invalid',
      hovered: cell(2, 0),
    });
  });

  it('the top edge of a valid cell lands in that cell, not the lane above', () => {
    const topEdge = { x: at(2, 3).x, y: at(2, 3).y - CELL_SIZE / 2 + CELL_INSET + 1 };
    expect(resolveDrop(trayPiece(0), topEdge, run, SNAP)).toMatchObject({
      command: { type: 'placeTile', to: cell(2, 3) },
    });
    const corner = { x: at(2, 3).x + 45, y: at(2, 3).y + 45 };
    expect(resolveDrop(trayPiece(0), corner, run, SNAP)).toMatchObject({
      command: { to: cell(2, 3) },
    });
  });

  it('the top of the tray returns a board tile', () => {
    const trayTop = { x: TRAY.x + TRAY.width / 2, y: TRAY.y + 1 };
    expect(resolveDrop(cellPiece(1, 1), trayTop, run, SNAP)).toMatchObject({
      command: { type: 'returnTile', from: cell(1, 1) },
    });
  });

  it('in a gutter or just outside the grid, snaps to the nearest valid cell within the radius', () => {
    // Gutter between (2,2) and (2,3), nearer (2,3).
    const gutter = { x: at(2, 3).x - CELL_SIZE / 2 + 1, y: at(2, 3).y };
    expect(resolveDrop(trayPiece(0), gutter, run, SNAP)).toMatchObject({
      command: { to: cell(2, 3) },
    });
    // Gutter between the locked (2,4) and empty (2,5): the valid neighbour wins.
    const byLocked = { x: at(2, 4).x + CELL_SIZE / 2 - 1, y: at(2, 4).y };
    expect(resolveDrop(trayPiece(0), byLocked, run, SNAP)).toMatchObject({
      command: { to: cell(2, 5) },
    });
    // The gap between the grid and the tray snaps to lane 4.
    const belowGrid = { x: at(4, 2).x, y: GRID.y + GRID.height + 5 };
    expect(resolveDrop(trayPiece(0), belowGrid, run, SNAP)).toMatchObject({
      command: { to: cell(4, 2) },
    });
    // Right of the grid: within the margin → (2,7); beyond it → invalid.
    const margin = { x: at(2, 7).x + CELL_SIZE * SNAP - 1, y: at(2, 7).y };
    expect(resolveDrop(trayPiece(0), margin, run, SNAP)).toMatchObject({
      command: { to: cell(2, 7) },
    });
    const outside = { x: at(2, 7).x + CELL_SIZE * SNAP + 1, y: at(2, 7).y };
    expect(resolveDrop(trayPiece(0), outside, run, SNAP)).toEqual({
      kind: 'invalid',
      hovered: null,
    });
  });

  it('draws the held piece above the finger without moving the drop point', () => {
    expect(heldPieceCenter({ x: 300, y: 400 }, 36)).toEqual({ x: 300, y: 364 });
  });

  it('every command it produces is accepted by the sim', async () => {
    const { applyCommand } = await import('../../sim/commands');
    const { realData } = await import('./boardFixtures');
    const drops: [DragSource, { x: number; y: number }][] = [
      [trayPiece(0), at(2, 3)],
      [cellPiece(1, 1), at(4, 7)],
      [cellPiece(0, 1), traySlotCenter(0, 0)],
      [{ kind: 'cannon', lane: 1 }, at(4, 0)],
    ];
    for (const [source, point] of drops) {
      const resolution = resolveDrop(source, point, run, SNAP);
      if (resolution.kind !== 'command') throw new Error(`expected a command for ${source.kind}`);
      expect(applyCommand(run, resolution.command, realData).ok).toBe(true);
    }
  });
});
