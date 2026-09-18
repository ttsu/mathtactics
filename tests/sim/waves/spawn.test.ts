import { describe, expect, it } from 'vitest';
import type { Robot, SpawnEntry } from '../../../sim/core/types';
import { spawn } from '../../../sim/waves/spawn';
import { expectEventSequence } from '../../helpers/eventSequence';
import { fakeGameData, fakeRunState } from '../commands/fixtures';

const data = fakeGameData({
  robots: [
    { id: 'basic', trait: { type: 'none' }, isBoss: false },
    { id: 'boss', trait: { type: 'bounceBack' }, isBoss: true },
  ],
});

function entry(overrides: Partial<SpawnEntry> = {}): SpawnEntry {
  return { turn: 1, lane: 0, robotTemplateId: 'basic', hp: 5, ...overrides };
}

function robot(overrides: Partial<Robot> = {}): Robot {
  return {
    robotId: 'robot:0',
    lane: 0,
    col: 7,
    hp: 3,
    maxHp: 3,
    trait: { type: 'none' },
    isBoss: false,
    ...overrides,
  };
}

function runState(overrides: Parameters<typeof fakeRunState>[0] = {}) {
  return fakeRunState({ mode: 'run', levelId: undefined, ...overrides });
}

describe('spawn', () => {
  it('enters a due Boss at col 6 (2x2 front) when the footprint is free', () => {
    const state = runState({
      pendingSpawns: [entry({ lane: 3, hp: 8, robotTemplateId: 'boss' })],
      nextIds: { robot: 4, piece: 0, ball: 0 },
    });

    const result = spawn(state, data);

    expect(result.state.board.robots).toEqual([
      {
        robotId: 'robot:4',
        lane: 3,
        col: 6,
        hp: 8,
        maxHp: 8,
        trait: { type: 'bounceBack' },
        isBoss: true,
      },
    ]);
    expect(result.state.pendingSpawns).toEqual([]);
    expect(result.state.nextIds.robot).toBe(5);
    expect(result.events).toEqual([
      {
        step: 0,
        group: 'spawn',
        type: 'RobotSpawned',
        robotId: 'robot:4',
        at: { lane: 3, col: 6 },
        hp: 8,
        maxHp: 8,
        trait: { type: 'bounceBack' },
        isBoss: true,
      },
    ]);
  });

  it('makes a due robot wait off-board (col null, RobotWaiting) when col 7 is occupied', () => {
    const state = runState({
      board: { ...runState().board, robots: [robot({ robotId: 'robot:0', lane: 2, col: 7 })] },
      pendingSpawns: [entry({ lane: 2, hp: 6 })],
      nextIds: { robot: 1, piece: 0, ball: 0 },
    });

    const result = spawn(state, data);

    expect(result.state.board.robots[1]).toMatchObject({ robotId: 'robot:1', lane: 2, col: null });
    expect(result.events).toEqual([
      {
        step: 0,
        group: 'spawn',
        type: 'RobotWaiting',
        robotId: 'robot:1',
        lane: 2,
        hp: 6,
        maxHp: 6,
        trait: { type: 'none' },
      },
    ]);
  });

  it('makes a Boss wait when a 1x1 occupies its back cell in the second lane', () => {
    const state = runState({
      board: {
        ...runState().board,
        robots: [robot({ robotId: 'robot:0', lane: 4, col: 7 })],
      },
      pendingSpawns: [entry({ lane: 3, hp: 8, robotTemplateId: 'boss' })],
      nextIds: { robot: 1, piece: 0, ball: 0 },
    });

    const result = spawn(state, data);

    expect(result.state.board.robots[1]).toMatchObject({
      robotId: 'robot:1',
      lane: 3,
      col: null,
      isBoss: true,
    });
    expect(result.events).toMatchObject([{ type: 'RobotWaiting', robotId: 'robot:1', lane: 3 }]);
  });

  it('only blocks on col 7 of the same lane', () => {
    const state = runState({
      board: {
        ...runState().board,
        robots: [robot({ lane: 1, col: 7 }), robot({ robotId: 'robot:1', lane: 2, col: 6 })],
      },
      pendingSpawns: [entry({ lane: 2 })],
      nextIds: { robot: 2, piece: 0, ball: 0 },
    });

    const result = spawn(state, data);

    expectEventSequence(result.events, [{ type: 'RobotSpawned', at: { lane: 2, col: 7 } }]);
  });

  it('enters a waiting robot before a newly scheduled robot in the same lane, keeping its id', () => {
    const waiting = robot({ robotId: 'robot:3', lane: 1, col: null, hp: 9, maxHp: 9 });
    const state = runState({
      board: { ...runState().board, robots: [waiting] },
      pendingSpawns: [entry({ lane: 1, hp: 2 })],
      nextIds: { robot: 4, piece: 0, ball: 0 },
    });

    const result = spawn(state, data);

    expect(result.events).toMatchObject([
      { step: 0, type: 'RobotSpawned', robotId: 'robot:3', at: { lane: 1, col: 7 }, hp: 9 },
      { step: 1, type: 'RobotWaiting', robotId: 'robot:4', lane: 1, hp: 2 },
    ]);
    expect(result.state.board.robots).toMatchObject([
      { robotId: 'robot:3', col: 7 },
      { robotId: 'robot:4', col: null },
    ]);
  });

  it('keeps a waiting robot waiting, with no event, while its spawn cell is still occupied', () => {
    const state = runState({
      board: {
        ...runState().board,
        robots: [
          robot({ robotId: 'robot:0', lane: 0, col: 7 }),
          robot({ robotId: 'robot:1', lane: 0, col: null }),
        ],
      },
    });

    const result = spawn(state, data);

    expect(result.events).toEqual([]);
    expect(result.state.board.robots[1]?.col).toBeNull();
  });

  it('enters the first of two robots due in one lane on one turn; the second waits', () => {
    const state = runState({
      pendingSpawns: [entry({ lane: 4, hp: 1 }), entry({ lane: 4, hp: 2 })],
    });

    const result = spawn(state, data);

    expect(result.events).toMatchObject([
      { step: 0, type: 'RobotSpawned', robotId: 'robot:0', hp: 1 },
      { step: 1, type: 'RobotWaiting', robotId: 'robot:1', hp: 2 },
    ]);
  });

  it('only spawns entries with turn <= state.turn, in schedule order, keeping the rest pending', () => {
    const later = entry({ turn: 4, lane: 0 });
    const state = runState({
      turn: 3,
      pendingSpawns: [
        entry({ turn: 1, lane: 2 }),
        entry({ turn: 3, lane: 1 }),
        later,
        entry({ turn: 5, lane: 3 }),
      ],
    });

    const result = spawn(state, data);

    expect(result.events.map((event) => event.type === 'RobotSpawned' && event.at.lane)).toEqual([
      2, 1,
    ]);
    expect(result.state.pendingSpawns).toEqual([later, entry({ turn: 5, lane: 3 })]);
  });

  it('numbers events in group "spawn" with strictly increasing steps from firstStep', () => {
    const state = runState({
      pendingSpawns: [entry({ lane: 0 }), entry({ lane: 0 }), entry({ lane: 1 })],
    });

    const result = spawn(state, data, 12);

    expect(result.events.map((event) => [event.group, event.step])).toEqual([
      ['spawn', 12],
      ['spawn', 13],
      ['spawn', 14],
    ]);
  });

  it('does not mutate the input state', () => {
    const waiting = robot({ col: null });
    const state = runState({
      board: { ...runState().board, robots: [waiting] },
      pendingSpawns: [entry({ lane: 3 })],
    });
    const snapshot = structuredClone(state);

    spawn(state, data);

    expect(state).toEqual(snapshot);
  });
});
