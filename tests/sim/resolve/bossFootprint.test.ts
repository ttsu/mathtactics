import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../../sim/commands/applyCommand';
import { resolveFire } from '../../../sim/resolve/fire';
import { advance } from '../../../sim/resolve/advance';
import type { Robot } from '../../../sim/core/types';
import { emptyCells, fakeGameData, fakeRunState } from '../commands/fixtures';
import { expectEventSequence } from '../../helpers/eventSequence';

const data = fakeGameData();

function boss(overrides: Partial<Robot> = {}): Robot {
  return {
    robotId: 'robot:boss',
    lane: 1,
    col: 6,
    hp: 1000,
    maxHp: 1000,
    trait: { type: 'none' },
    isBoss: true,
    ...overrides,
  };
}

describe('2x2 Boss occupancy', () => {
  it('locks all four cells against tile placement', () => {
    const state = fakeRunState({
      tray: ['p1'],
      pieces: { p1: { pieceId: 'p1', tileId: 'add:2' } },
      board: {
        cannons: [true, true, true, false, false],
        cells: emptyCells(),
        robots: [boss()],
      },
    });
    for (const cell of [
      { lane: 1, col: 6 },
      { lane: 1, col: 7 },
      { lane: 2, col: 6 },
      { lane: 2, col: 7 },
    ] as const) {
      expect(applyCommand(state, { type: 'placeTile', pieceId: 'p1', to: cell }, data)).toEqual({
        ok: false,
        error: 'cell_locked',
      });
    }
    const open = applyCommand(state, { type: 'placeTile', pieceId: 'p1', to: { lane: 1, col: 5 } }, data);
    expect(open.ok).toBe(true);
  });

  it('both occupied lanes hit the same Boss', () => {
    const state = fakeRunState({
      mode: 'run',
      cannonBaseValue: 1,
      board: {
        cannons: [false, true, true, false, false],
        cells: emptyCells(),
        robots: [boss()],
      },
    });

    const { events, board } = resolveFire(state, data);

    expectEventSequence(events, [
      { type: 'RobotDamaged', robotId: 'robot:boss', at: { lane: 1, col: 6 }, damage: 1, hpBefore: 1000, hpAfter: 999 },
      { type: 'RobotDamaged', robotId: 'robot:boss', at: { lane: 2, col: 6 }, damage: 1, hpBefore: 999, hpAfter: 998 },
    ]);
    expect(board.robots[0]?.hp).toBe(998);
  });

  it('advances one column, keeping the 2x2, and detonates from col 1', () => {
    const moved = advance(
      { cannons: [false, true, true, false, false], cells: emptyCells(), robots: [boss({ col: 6 })] },
      0,
    );
    expect(moved.robots).toEqual([boss({ col: 5 })]);
    expect(moved.events).toMatchObject([{ type: 'RobotAdvanced', from: { lane: 1, col: 6 }, to: { lane: 1, col: 5 } }]);

    const boom = advance(
      { cannons: [false, true, true, false, false], cells: emptyCells(), robots: [boss({ col: 1, hp: 40, maxHp: 1000 })] },
      0,
    );
    expect(boom.robots).toEqual([]);
    expect(boom.detonating).toEqual([boss({ col: 1, hp: 40, maxHp: 1000 })]);
  });
});
