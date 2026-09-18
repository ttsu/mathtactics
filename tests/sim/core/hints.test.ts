import { describe, expect, it } from 'vitest';
import type { Col, Lane } from '../../../sim/core/coords';
import { laneHintValues } from '../../../sim/core/hints';
import type { Robot, RunState, TileId } from '../../../sim/core/types';
import { emptyCells, fakeGameData, fakeRunState, fakeTile } from '../commands/fixtures';

const data = fakeGameData({
  tiles: [
    fakeTile({ id: 'add:4', n: 4 }),
    fakeTile({
      id: 'mul:3',
      kind: 'mul',
      n: 3,
      priceCategory: 'mulLow',
      color: 'orange',
    }),
    fakeTile({ id: 'sub:2', kind: 'sub', n: 2, priceCategory: 'sub', color: 'blue' }),
    fakeTile({ id: 'sub:4', kind: 'sub', n: 4, priceCategory: 'sub', color: 'blue' }),
    fakeTile({ id: 'add:5', n: 5 }),
  ],
});

function robot(overrides: Partial<Robot> = {}): Robot {
  return {
    robotId: 'r1',
    lane: 0,
    col: 7,
    hp: 10,
    maxHp: 10,
    trait: { type: 'none' },
    isBoss: false,
    ...overrides,
  };
}

function place(
  cells: (string | null)[][],
  lane: Lane,
  col: Col,
  pieceId: string,
): (string | null)[][] {
  const next = cells.map((row) => [...row]);
  next[lane]![col] = pieceId;
  return next;
}

function armedLane(overrides: {
  cells?: (string | null)[][];
  pieces?: RunState['pieces'];
  robots?: Robot[];
  cannons?: boolean[];
  cannonBaseValue?: number;
}): RunState {
  return fakeRunState({
    cannonBaseValue: overrides.cannonBaseValue ?? 1,
    pieces: overrides.pieces ?? {},
    board: {
      cannons: overrides.cannons ?? [true, false, false, false, false],
      cells: overrides.cells ?? emptyCells(),
      robots: overrides.robots ?? [],
    },
  });
}

/** `(1) +4 ×3 −2` along cols 1–3 of lane 0. */
function plusMulMinus(cells = emptyCells()): {
  cells: (string | null)[][];
  pieces: RunState['pieces'];
} {
  let next = cells;
  next = place(next, 0, 1, 'p-add');
  next = place(next, 0, 2, 'p-mul');
  next = place(next, 0, 3, 'p-sub');
  return {
    cells: next,
    pieces: {
      'p-add': { pieceId: 'p-add', tileId: 'add:4' satisfies TileId },
      'p-mul': { pieceId: 'p-mul', tileId: 'mul:3' satisfies TileId },
      'p-sub': { pieceId: 'p-sub', tileId: 'sub:2' satisfies TileId },
    },
  };
}

describe('laneHintValues', () => {
  it('(1) +4 ×3 −2 with a robot at col 7 → [5, 15, 13] on those cells', () => {
    const { cells, pieces } = plusMulMinus();
    const state = armedLane({ cells, pieces, robots: [robot({ col: 7 })] });
    expect(laneHintValues(state, 0, data)).toEqual([
      { col: 1, value: 5 },
      { col: 2, value: 15 },
      { col: 3, value: 13 },
    ]);
  });

  it('a robot on col 4 with tiles only in 1–3 stops totals before the robot', () => {
    const { cells, pieces } = plusMulMinus();
    // A tile behind the robot must not contribute — the walk stops strictly left of col 4.
    const withBehind = place(cells, 0, 5, 'p-behind');
    const state = armedLane({
      cells: withBehind,
      pieces: { ...pieces, 'p-behind': { pieceId: 'p-behind', tileId: 'add:5' } },
      robots: [robot({ col: 4 })],
    });
    expect(laneHintValues(state, 0, data)).toEqual([
      { col: 1, value: 5 },
      { col: 2, value: 15 },
      { col: 3, value: 13 },
    ]);
  });

  it('a robot on col 1 → []', () => {
    const { cells, pieces } = plusMulMinus();
    const state = armedLane({ cells, pieces, robots: [robot({ col: 1 })] });
    expect(laneHintValues(state, 0, data)).toEqual([]);
  });

  it('an unarmed lane → [] even with tiles on it', () => {
    const { cells, pieces } = plusMulMinus();
    const state = armedLane({
      cells,
      pieces,
      cannons: [false, false, false, false, false],
      robots: [robot({ col: 7 })],
    });
    expect(laneHintValues(state, 0, data)).toEqual([]);
  });

  it('a waiting robot does not truncate', () => {
    const { cells, pieces } = plusMulMinus();
    const state = armedLane({
      cells,
      pieces,
      robots: [robot({ col: null })],
    });
    expect(laneHintValues(state, 0, data)).toEqual([
      { col: 1, value: 5 },
      { col: 2, value: 15 },
      { col: 3, value: 13 },
    ]);
  });

  it('applies × then + in that order', () => {
    let cells = emptyCells();
    cells = place(cells, 0, 1, 'p-mul');
    cells = place(cells, 0, 2, 'p-add');
    const state = armedLane({
      cells,
      pieces: {
        'p-mul': { pieceId: 'p-mul', tileId: 'mul:3' },
        'p-add': { pieceId: 'p-add', tileId: 'add:4' },
      },
    });
    expect(laneHintValues(state, 0, data)).toEqual([
      { col: 1, value: 3 },
      { col: 2, value: 7 },
    ]);
  });

  it('shows a negative running total as-is (GDD §2.1 — never clamped)', () => {
    let cells = emptyCells();
    cells = place(cells, 0, 1, 'p-sub');
    cells = place(cells, 0, 2, 'p-mul');
    const state = armedLane({
      cells,
      pieces: {
        'p-sub': { pieceId: 'p-sub', tileId: 'sub:4' },
        'p-mul': { pieceId: 'p-mul', tileId: 'mul:3' },
      },
    });
    expect(laneHintValues(state, 0, data)).toEqual([
      { col: 1, value: -3 },
      { col: 2, value: -9 },
    ]);
  });

  it('must not consult robot.trait — odd-only / weakness do not change hints', () => {
    const { cells, pieces } = plusMulMinus();
    const none = armedLane({ cells, pieces, robots: [robot({ col: 7, trait: { type: 'none' } })] });
    const oddOnly = armedLane({
      cells,
      pieces,
      robots: [robot({ col: 7, trait: { type: 'oddOnly' } })],
    });
    const weakness = armedLane({
      cells,
      pieces,
      robots: [robot({ col: 7, trait: { type: 'weakness', n: 5 } })],
    });
    expect(laneHintValues(oddOnly, 0, data)).toEqual(laneHintValues(none, 0, data));
    expect(laneHintValues(weakness, 0, data)).toEqual(laneHintValues(none, 0, data));
  });

  it('skips empty cells (no emitted value) and keeps walking', () => {
    let cells = emptyCells();
    cells = place(cells, 0, 1, 'p-add');
    cells = place(cells, 0, 3, 'p-mul');
    const state = armedLane({
      cells,
      pieces: {
        'p-add': { pieceId: 'p-add', tileId: 'add:4' },
        'p-mul': { pieceId: 'p-mul', tileId: 'mul:3' },
      },
    });
    expect(laneHintValues(state, 0, data)).toEqual([
      { col: 1, value: 5 },
      { col: 3, value: 15 },
    ]);
  });

  it('a 2x2 Boss in lane 1 also stops hints in its second lane', () => {
    let cells = emptyCells();
    cells = place(cells, 2, 1, 'p-add');
    cells = place(cells, 2, 3, 'p-mul');
    const state = armedLane({
      cells,
      pieces: {
        'p-add': { pieceId: 'p-add', tileId: 'add:4' },
        'p-mul': { pieceId: 'p-mul', tileId: 'mul:3' },
      },
      cannons: [false, false, true, false, false],
      robots: [robot({ lane: 1, col: 3, isBoss: true, hp: 1000, maxHp: 1000 })],
    });
    expect(laneHintValues(state, 2, data)).toEqual([{ col: 1, value: 5 }]);
  });
});
