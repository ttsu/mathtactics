import { describe, expect, it } from 'vitest';
import { planningHintMarks } from '../../game/board/planningHints';
import type { Robot } from '../../sim/core/types';
import { emptyCells, fakeGameData, fakeRunState, fakeTile } from '../sim/commands/fixtures';

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

function armedWithTile() {
  const cells = emptyCells();
  cells[0]![1] = 'p1';
  return fakeRunState({
    cannonBaseValue: 1,
    pieces: { p1: { pieceId: 'p1', tileId: 'add:4' } },
    board: {
      cannons: [true, false, false, false, false],
      cells,
      robots: [robot()],
    },
  });
}

const ON_THE_BOARD = [{ lane: 0, col: 1, value: 5 }] as const;

describe('planningHintMarks (board draw seam)', () => {
  it('returns lane totals when hints are on, planning, and playback is idle', () => {
    expect(planningHintMarks(armedWithTile(), data, true, true)).toEqual([...ON_THE_BOARD]);
  });

  it('returns [] when the hints flag is off (drawer is not given marks)', () => {
    expect(planningHintMarks(armedWithTile(), data, false, true)).toEqual([]);
  });

  it('returns [] while playback is running', () => {
    expect(planningHintMarks(armedWithTile(), data, true, false)).toEqual([]);
  });

  it('returns [] outside planning', () => {
    const run = { ...armedWithTile(), phase: 'waveCleared' as const };
    expect(planningHintMarks(run, data, true, true)).toEqual([]);
  });

  it('returns [] when there is no run', () => {
    expect(planningHintMarks(null, data, true, true)).toEqual([]);
  });
});
