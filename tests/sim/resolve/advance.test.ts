// ADVANCE unit tests (GDD §4 step 4, TR §6; task 13 requirement). `decideAdvance` is tested
// directly for the "stay" branch, which front-most-first sweep order with speed-1 robots can
// never actually trigger through `advance` itself (task 13 context note).

import { describe, expect, it } from 'vitest';
import { advance, decideAdvance } from '../../../sim/resolve/advance';
import type { Board, Robot } from '../../../sim/core/types';
import { emptyCells } from '../commands/fixtures';

function robot(overrides: Partial<Robot> = {}): Robot {
  return {
    robotId: 'robot:0',
    lane: 0,
    col: 5,
    hp: 3,
    maxHp: 3,
    trait: { type: 'none' },
    isBoss: false,
    ...overrides,
  };
}

function board(robots: Robot[]): Board {
  return { cannons: [true, false, false, false, false], cells: emptyCells(), robots };
}

describe('decideAdvance — per-robot decision (GDD §4 step 4)', () => {
  it('detonates a robot on col 1, regardless of occupancy', () => {
    const decision = decideAdvance(robot({ col: 1 }), () => true);
    expect(decision).toEqual({ kind: 'detonate' });
  });

  it('moves left when the target cell is empty', () => {
    const decision = decideAdvance(robot({ col: 5 }), () => false);
    expect(decision).toEqual({ kind: 'move', to: 4 });
  });

  it(
    'stays when the target cell is occupied — proven directly since front-most-first ' +
      'ordering with speed 1 means this branch is unreachable through `advance` in v1',
    () => {
      const decision = decideAdvance(robot({ col: 5 }), (lane, col) => lane === 0 && col === 4);
      expect(decision).toEqual({ kind: 'stay' });
    },
  );

  it('throws for an off-board (waiting) robot', () => {
    expect(() => decideAdvance(robot({ col: null }), () => false)).toThrow(/off-board/);
  });
});

describe('advance — full sweep (GDD §4 step 4, TR §6)', () => {
  it('moves a single robot one cell left and emits RobotAdvanced', () => {
    const b = board([robot({ col: 5 })]);
    const result = advance(b, 0);

    expect(result.robots).toEqual([robot({ col: 4 })]);
    expect(result.detonating).toEqual([]);
    expect(result.events).toEqual([
      {
        step: 0,
        group: 'advance',
        type: 'RobotAdvanced',
        robotId: 'robot:0',
        from: { lane: 0, col: 5 },
        to: { lane: 0, col: 4 },
      },
    ]);
  });

  it('queues a col-1 robot to detonate and frees the cell, emitting no advance event for it', () => {
    const b = board([robot({ col: 1, hp: 7, maxHp: 7 })]);
    const result = advance(b, 0);

    expect(result.robots).toEqual([]);
    expect(result.detonating).toEqual([robot({ col: 1, hp: 7, maxHp: 7 })]);
    expect(result.events).toEqual([]);
  });

  it('processes front-most first: a chain of 3 adjacent robots in one lane all advance together', () => {
    const b = board([
      robot({ robotId: 'robot:0', col: 1 }),
      robot({ robotId: 'robot:1', col: 2 }),
      robot({ robotId: 'robot:2', col: 3 }),
    ]);
    const result = advance(b, 0);

    expect(result.detonating.map((r) => r.robotId)).toEqual(['robot:0']);
    expect(result.robots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ robotId: 'robot:1', col: 1 }),
        expect.objectContaining({ robotId: 'robot:2', col: 2 }),
      ]),
    );
    expect(result.robots).toHaveLength(2);

    const advanced = result.events.filter((e) => e.type === 'RobotAdvanced');
    expect(advanced).toHaveLength(2);
    expect(advanced[0]).toMatchObject({ robotId: 'robot:1', from: { col: 2 }, to: { col: 1 } });
    expect(advanced[1]).toMatchObject({ robotId: 'robot:2', from: { col: 3 }, to: { col: 2 } });
  });

  it('col-1 robot detonates and the robot behind it moves into col 1 in the same sweep', () => {
    const b = board([robot({ robotId: 'robot:0', col: 1 }), robot({ robotId: 'robot:1', col: 2 })]);
    const result = advance(b, 0);

    expect(result.detonating.map((r) => r.robotId)).toEqual(['robot:0']);
    expect(result.robots).toEqual([robot({ robotId: 'robot:1', col: 1 })]);
  });

  it('breaks ties by lane ascending at the same column', () => {
    const b = board([
      robot({ robotId: 'robot:hi', lane: 3, col: 1 }),
      robot({ robotId: 'robot:lo', lane: 0, col: 1 }),
    ]);
    const result = advance(b, 0);

    expect(result.detonating.map((r) => r.robotId)).toEqual(['robot:lo', 'robot:hi']);
  });

  it('never advances a waiting (off-board) robot', () => {
    const b = board([robot({ col: null })]);
    const result = advance(b, 0);

    expect(result.robots).toEqual([robot({ col: null })]);
    expect(result.detonating).toEqual([]);
    expect(result.events).toEqual([]);
  });

  it('continues `step` from `firstStep`', () => {
    const b = board([robot({ col: 5 }), robot({ robotId: 'robot:1', lane: 1, col: 5 })]);
    const result = advance(b, 10);

    expect(result.events.map((e) => e.step)).toEqual([10, 11]);
  });

  it('does not mutate the input board', () => {
    const b = board([robot({ col: 5 })]);
    const snapshot = structuredClone(b);
    advance(b, 0);
    expect(b).toEqual(snapshot);
  });
});
