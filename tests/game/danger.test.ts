import { describe, expect, it } from 'vitest';
import { dangerLanes } from '../../game/board/playback/danger';
import type { Robot } from '../../sim/core/types';
import { emptyCells, fakeRunState } from '../sim/commands/fixtures';

function robot(overrides: Partial<Robot> = {}): Robot {
  return {
    robotId: 'r1',
    lane: 0,
    col: 1,
    hp: 5,
    maxHp: 5,
    trait: { type: 'none' },
    isBoss: false,
    ...overrides,
  };
}

describe('dangerLanes', () => {
  it('is empty with no robots on the board', () => {
    const run = fakeRunState({ board: { cannons: [], cells: emptyCells(), robots: [] } });
    expect(dangerLanes(run)).toEqual([]);
  });

  it('finds only lanes whose robot sits on column 1', () => {
    const run = fakeRunState({
      board: {
        cannons: [],
        cells: emptyCells(),
        robots: [
          robot({ robotId: 'r1', lane: 0, col: 1 }),
          robot({ robotId: 'r2', lane: 1, col: 3 }), // not column 1
          robot({ robotId: 'r3', lane: 3, col: 1 }),
        ],
      },
    });
    expect(dangerLanes(run)).toEqual([0, 3]);
  });

  it('ignores waiting robots even when they would land on column 1 once spawned', () => {
    const run = fakeRunState({
      board: {
        cannons: [],
        cells: emptyCells(),
        robots: [robot({ robotId: 'r1', lane: 2, col: null })],
      },
    });
    expect(dangerLanes(run)).toEqual([]);
  });

  it('returns lanes sorted ascending regardless of robot order', () => {
    const run = fakeRunState({
      board: {
        cannons: [],
        cells: emptyCells(),
        robots: [
          robot({ robotId: 'r1', lane: 4, col: 1 }),
          robot({ robotId: 'r2', lane: 0, col: 1 }),
          robot({ robotId: 'r3', lane: 2, col: 1 }),
        ],
      },
    });
    expect(dangerLanes(run)).toEqual([0, 2, 4]);
  });

  it('never returns the same lane twice, even with two robots on column 1 in the same lane', () => {
    // Not reachable through real play (one robot per cell), but the derivation should still be
    // safe against it rather than assume the invariant.
    const run = fakeRunState({
      board: {
        cannons: [],
        cells: emptyCells(),
        robots: [
          robot({ robotId: 'r1', lane: 1, col: 1 }),
          robot({ robotId: 'r2', lane: 1, col: 1 }),
        ],
      },
    });
    expect(dangerLanes(run)).toEqual([1]);
  });
});
