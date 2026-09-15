import { describe, expect, it } from 'vitest';
import {
  boardSliceChanged,
  formatNumber,
  pieceHomes,
  tileColor,
  tileLabel,
} from '../../game/board/pieces';
import { applyCommand } from '../../sim/commands';
import { boardState, realData } from './boardFixtures';

describe('tileLabel', () => {
  it('uses the real − and × glyphs', () => {
    expect(tileLabel('add:4')).toBe('+4');
    expect(tileLabel('sub:10')).toBe('−10');
    expect(tileLabel('mul:3')).toBe('×3');
  });
});

describe('tileColor', () => {
  it('maps a tile to its presentation.json colour and starred flag', () => {
    const colors = realData.presentation.tileColors;
    expect(tileColor('add:1', realData)).toEqual({ hex: colors.green, starred: false });
    expect(tileColor('sub:2', realData)).toEqual({ hex: colors.blue, starred: false });
    expect(tileColor('mul:5', realData)).toEqual({ hex: colors.orange, starred: false });
    expect(tileColor('mul:6', realData)).toEqual({ hex: colors.orange, starred: true });
  });

  it('throws for an unknown tile', () => {
    expect(() => tileColor('add:99', realData)).toThrow('unknown tile id');
  });
});

describe('pieceHomes', () => {
  it('locates every piece on a cell or at its tray index', () => {
    const run = boardState(
      [
        'C +2 . . . . . .',
        '. . . . . . . .',
        '. . . . x3 . . .',
        '. . . . . . . .',
        '. . . . . . . .',
      ],
      ['add:4', 'sub:2'],
    );
    const homes = pieceHomes(run);
    expect(homes.size).toBe(4);
    expect(homes.get(run.board.cells[0]![1]!)).toEqual({ kind: 'cell', cell: { lane: 0, col: 1 } });
    expect(homes.get(run.board.cells[2]![4]!)).toEqual({ kind: 'cell', cell: { lane: 2, col: 4 } });
    expect(homes.get(run.tray[1]!)).toEqual({ kind: 'tray', index: 1 });
  });
});

describe('boardSliceChanged', () => {
  const rows = [
    'C . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
  ];

  it('is false for the same state and true when a run appears or disappears', () => {
    const run = boardState(rows, ['add:4']);
    expect(boardSliceChanged(run, run)).toBe(false);
    expect(boardSliceChanged(null, null)).toBe(false);
    expect(boardSliceChanged(null, run)).toBe(true);
    expect(boardSliceChanged(run, null)).toBe(true);
  });

  it('is true after a planning command and false when only non-board state changed', () => {
    const run = boardState(rows, ['add:4']);
    const placed = applyCommand(
      run,
      { type: 'placeTile', pieceId: run.tray[0]!, to: { lane: 0, col: 3 } },
      realData,
    );
    if (!placed.ok) throw new Error(placed.error);
    expect(boardSliceChanged(run, placed.state)).toBe(true);
    expect(boardSliceChanged(run, { ...run, coins: 5 })).toBe(false);
    expect(boardSliceChanged(run, { ...run, cannonBaseValue: 4 })).toBe(true);
  });
});

describe('formatNumber', () => {
  it('uses a real minus sign for negatives, like tile labels', () => {
    expect(formatNumber(13)).toBe('13');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-2)).toBe('−2');
    expect(formatNumber(-2)).not.toContain('-');
  });
});
