import { describe, expect, it } from 'vitest';
import { pickUpAt, resolveDrop, type DragSource } from '../../game/board/dragTargets';
import { CELL_SIZE, TRAY, cellCenter, traySlotCenter } from '../../game/board/layout';
import type { Cell } from '../../sim/core/coords';
import { boardState } from './boardFixtures';

// Lane 0: tile on (0,1), robot locks (0,5) standing on a ×3 tile. Lane 1: cannon + tile on (1,1).
const run = boardState(
  [
    '. +5 . . . R7[x3] . .',
    'C +2 . . . . . .',
    '. . . . . . . .',
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

  it('a locked or occupied cell with nothing valid in reach is invalid and reports the cell', () => {
    expect(resolveDrop(trayPiece(0), at(0, 5), run, SNAP)).toEqual({
      kind: 'invalid',
      hovered: cell(0, 5),
    });
    expect(resolveDrop(trayPiece(0), at(1, 1), run, SNAP)).toEqual({
      kind: 'invalid',
      hovered: cell(1, 1),
    });
    // Tiles never go into the cannon slot column; only its edge is within (2,1)'s snap margin.
    expect(resolveDrop(trayPiece(0), at(2, 0), run, SNAP)).toEqual({
      kind: 'invalid',
      hovered: cell(2, 0),
    });
    expect(
      resolveDrop(trayPiece(0), { x: at(2, 0).x + 30, y: at(2, 0).y }, run, SNAP),
    ).toMatchObject({ command: { type: 'placeTile', to: cell(2, 1) } });
  });

  it('snaps to the nearest valid cell within the radius (per axis), never beyond it', () => {
    // Near the edge of the locked (0,5), inside (0,4)'s snap margin.
    const nearEdge = { x: at(0, 5).x - 30, y: at(0, 5).y };
    expect(resolveDrop(trayPiece(0), nearEdge, run, SNAP)).toMatchObject({
      command: { type: 'placeTile', to: cell(0, 4) },
    });
    // A cell corner is inside the cell, so it still counts even though it's > radius diagonally.
    const corner = { x: at(2, 3).x + 49, y: at(2, 3).y + 49 };
    expect(resolveDrop(trayPiece(0), corner, run, SNAP)).toMatchObject({
      command: { to: cell(2, 3) },
    });
    // Right of the grid, beyond any snap margin.
    const outside = { x: at(2, 7).x + CELL_SIZE * SNAP + 1, y: at(2, 7).y };
    expect(resolveDrop(trayPiece(0), outside, run, SNAP)).toEqual({
      kind: 'invalid',
      hovered: null,
    });
    // Within the margin right of the grid → (2,7).
    const margin = { x: at(2, 7).x + CELL_SIZE * SNAP - 1, y: at(2, 7).y };
    expect(resolveDrop(trayPiece(0), margin, run, SNAP)).toMatchObject({
      command: { to: cell(2, 7) },
    });
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
