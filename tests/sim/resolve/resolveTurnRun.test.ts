// `resolveTurn` for `mode: 'run'` (GDD §4, §4.4, §7.2, §10.5, §10.6; TR §6, §7; task 13).
// FIRE-only behavior (level mode) is covered by `resolveTurn.test.ts` — this file covers
// ADVANCE, DETONATE, END CHECK, fast-forward, SPAWN, wave clear/win/lose, and `exactKills`.

import { describe, expect, it } from 'vitest';
import { resolveTurn } from '../../../sim/resolve/resolveTurn';
import { buildLevelState } from '../../../sim/commands/level';
import type { Robot, RunState } from '../../../sim/core/types';
import type { GameData } from '../../../sim/data/schemas';
import { fakeGameData, fakeLevelDef, fakeRunState } from '../commands/fixtures';
import { expectEventSequence } from '../../helpers/eventSequence';

function robot(overrides: Partial<Robot> = {}): Robot {
  return {
    robotId: 'robot:0',
    lane: 0,
    col: 7,
    hp: 5,
    maxHp: 5,
    trait: { type: 'none' },
    isBoss: false,
    ...overrides,
  };
}

function runState(overrides: Partial<RunState> = {}): RunState {
  return fakeRunState({ mode: 'run', levelId: undefined, ...overrides });
}

/** A tiny 2-wave `GameData` for END CHECK / wave-clear / win tests. */
function twoWaveData(overrides: Partial<GameData> = {}): GameData {
  return fakeGameData({
    robots: [{ id: 'basic', trait: { type: 'none' }, isBoss: false }],
    waves: {
      waves: [
        {
          id: 'wave-1',
          spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [1, 1] }],
        },
        { id: 'wave-2', spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [1, 1] }] },
      ],
    },
    ...overrides,
  });
}

describe('resolveTurn — mode: run — ADVANCE', () => {
  it('a surviving robot advances one cell left after FIRE misses', () => {
    const data = fakeGameData();
    const state = runState({
      board: {
        cannons: [true, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [robot({ col: 5 })],
      },
    });

    const { events, state: next } = resolveTurn(state, data);

    expectEventSequence(events, [{ type: 'RobotAdvanced', from: { col: 5 }, to: { col: 4 } }]);
    expect(next.board.robots.find((r) => r.robotId === 'robot:0')?.col).toBe(4);
  });
});

describe('resolveTurn — mode: run — DETONATE and chip damage', () => {
  // These tests empty the board via detonation, which also satisfies the wave-clear condition
  // (GDD §10.3) — `twoWaveData()` gives END CHECK a real wave to look up instead of crashing on
  // `fakeGameData()`'s empty `waves.waves`; the wave-clear side effects it adds are irrelevant to
  // what each test asserts.
  it('a robot on col 1 not killed detonates for its remaining HP; base HP drops', () => {
    const data = twoWaveData();
    const state = runState({
      baseHp: 100,
      board: {
        cannons: [false, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [robot({ col: 1, hp: 7, maxHp: 7 })],
      },
    });

    const { events, state: next } = resolveTurn(state, data);

    expectEventSequence(events, [
      { type: 'RobotDetonated', lane: 0, damage: 7 },
      { type: 'BaseDamaged', amount: 7, hpBefore: 100, hpAfter: 93 },
    ]);
    expect(next.baseHp).toBe(93);
    expect(next.board.robots).toHaveLength(0);
  });

  it('chip damage: a robot worn down by FIRE then detonates for the remainder', () => {
    const data = twoWaveData();
    const state = runState({
      baseHp: 100,
      cannonBaseValue: 3,
      board: {
        cannons: [true, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [robot({ col: 1, hp: 10, maxHp: 10 })],
      },
    });

    const { events, state: next } = resolveTurn(state, data);

    // Ball worth 3 hits for 3 damage (hp 10 -> 7, survives), then it detonates for the remainder.
    expectEventSequence(events, [
      { type: 'RobotDamaged', damage: 3, hpBefore: 10, hpAfter: 7 },
      { type: 'RobotDetonated', damage: 7 },
      { type: 'BaseDamaged', amount: 7, hpBefore: 100, hpAfter: 93 },
    ]);
    expect(next.baseHp).toBe(93);
  });

  it('resolves detonations in lane order across two lanes', () => {
    const data = twoWaveData();
    const state = runState({
      baseHp: 100,
      board: {
        cannons: [false, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [
          robot({ robotId: 'robot:hi', lane: 3, col: 1, hp: 5, maxHp: 5 }),
          robot({ robotId: 'robot:lo', lane: 0, col: 1, hp: 4, maxHp: 4 }),
        ],
      },
    });

    const { events } = resolveTurn(state, data);
    const detonated = events.filter((e) => e.type === 'RobotDetonated');
    expect(detonated.map((e) => (e as { lane: number }).lane)).toEqual([0, 3]);
  });
});

describe('resolveTurn — mode: run — ADVANCE ordering scenarios', () => {
  it('a queue of robots in one lane all advance together, front-most first', () => {
    const data = fakeGameData();
    const state = runState({
      board: {
        cannons: [false, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [
          robot({ robotId: 'robot:0', col: 2 }),
          robot({ robotId: 'robot:1', col: 3 }),
          robot({ robotId: 'robot:2', col: 4 }),
        ],
      },
    });

    const { state: next } = resolveTurn(state, data);
    const cols = Object.fromEntries(next.board.robots.map((r) => [r.robotId, r.col]));
    expect(cols).toEqual({ 'robot:0': 1, 'robot:1': 2, 'robot:2': 3 });
  });

  it('front robot killed during FIRE lets the robot behind it advance into the freed cell', () => {
    const data = fakeGameData();
    const state = runState({
      cannonBaseValue: 5,
      board: {
        cannons: [true, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [
          robot({ robotId: 'front', col: 3, hp: 5, maxHp: 5 }),
          robot({ robotId: 'behind', col: 4, hp: 99, maxHp: 99 }),
        ],
      },
    });

    const { events, state: next } = resolveTurn(state, data);

    expectEventSequence(events, [
      { type: 'RobotDefeated', robotId: 'front', exact: true },
      { type: 'RobotAdvanced', robotId: 'behind', from: { col: 4 }, to: { col: 3 } },
    ]);
    const behind = next.board.robots.find((r) => r.robotId === 'behind');
    expect(behind?.col).toBe(3);
  });

  it('two robots due in the same lane on the same turn: one spawns, one waits; the waiter enters next turn', () => {
    const data = fakeGameData({
      robots: [{ id: 'basic', trait: { type: 'none' }, isBoss: false }],
    });
    const state = runState({
      turn: 4,
      cannonBaseValue: 0,
      pendingSpawns: [
        { turn: 5, lane: 1, robotTemplateId: 'basic', hp: 3 },
        { turn: 5, lane: 1, robotTemplateId: 'basic', hp: 3 },
      ],
      board: {
        cannons: [false, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [],
      },
    });

    const first = resolveTurn(state, data);
    expect(first.state.turn).toBe(5);
    expectEventSequence(first.events, [
      { type: 'RobotSpawned', at: { lane: 1, col: 7 } },
      { type: 'RobotWaiting', lane: 1 },
    ]);
    const laneOneRobots = first.state.board.robots.filter((r) => r.lane === 1);
    expect(laneOneRobots).toHaveLength(2);
    const occupant = laneOneRobots.find((r) => r.col === 7)!;
    const waiter = laneOneRobots.find((r) => r.col === null)!;

    // Next turn: ADVANCE frees col 7 (the occupant steps to col 6), then SPAWN lets the waiter in.
    const second = resolveTurn(first.state, data);
    expect(second.state.turn).toBe(6);
    const occupantAfter = second.state.board.robots.find((r) => r.robotId === occupant.robotId);
    expect(occupantAfter?.col).toBe(6);
    const waiterAfter = second.state.board.robots.find((r) => r.robotId === waiter.robotId);
    expect(waiterAfter?.col).toBe(7);
    expectEventSequence(second.events, [
      { type: 'RobotAdvanced', robotId: occupant.robotId, from: { col: 7 }, to: { col: 6 } },
      { type: 'RobotSpawned', robotId: waiter.robotId, at: { lane: 1, col: 7 } },
    ]);
  });
});

describe('resolveTurn — mode: run — fast-forward (GDD §4.4)', () => {
  it('jumps `turn` to the next scheduled spawn when the board is emptied with spawns remaining', () => {
    const data = fakeGameData({
      robots: [{ id: 'basic', trait: { type: 'none' }, isBoss: false }],
    });
    const state = runState({
      turn: 1,
      cannonBaseValue: 1,
      pendingSpawns: [{ turn: 5, lane: 2, robotTemplateId: 'basic', hp: 3 }],
      board: {
        cannons: [true, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [robot({ lane: 0, col: 7, hp: 1, maxHp: 1 })],
      },
    });

    const { state: next, events } = resolveTurn(state, data);

    expect(next.turn).toBe(5);
    expect(next.pendingSpawns).toEqual([]);
    expectEventSequence(events, [
      { type: 'RobotDefeated', exact: true },
      { type: 'RobotSpawned', at: { lane: 2, col: 7 }, hp: 3 },
    ]);
  });

  it('does not jump when the board still has a robot', () => {
    const data = fakeGameData();
    const state = runState({
      turn: 1,
      pendingSpawns: [{ turn: 5, lane: 2, robotTemplateId: 'basic', hp: 3 }],
      board: {
        cannons: [false, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [robot({ col: 6 })],
      },
    });

    const { state: next } = resolveTurn(state, data);
    expect(next.turn).toBe(2);
  });
});

describe('resolveTurn — mode: run — wave clear, tiles, win, lose (GDD §10.5, §10.6)', () => {
  function clearingState(data: GameData, overrides: Partial<RunState> = {}): RunState {
    return runState({
      waveIndex: 0,
      coins: 0,
      baseHp: 100,
      pendingSpawns: [],
      board: {
        cannons: [true, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [robot({ hp: 5, maxHp: 5 })],
      },
      cannonBaseValue: 5,
      ...overrides,
    });
  }

  it('a non-final wave clear pays coins, phase waveCleared, and grants no tiles', () => {
    const data = twoWaveData();
    const state = clearingState(data);

    const { events, state: next } = resolveTurn(state, data);

    expectEventSequence(events, [
      { type: 'RobotDefeated', exact: true },
      { type: 'WaveCleared', waveIndex: 0 },
      { type: 'CoinsChanged', reason: 'waveCleared', delta: data.economy.income.waveCleared },
    ]);
    expect(events.some((e) => e.type === 'TilesGranted')).toBe(false);
    expect(next.phase).toBe('waveCleared');
    // The exact kill's coin (FIRE) plus the wave-cleared coin (END CHECK), both this same turn.
    expect(next.coins).toBe(data.economy.income.exactKill + data.economy.income.waveCleared);
    expect(next.tray).toEqual([]);
  });

  it('the final wave clear wins the run, with no TilesGranted', () => {
    const data = twoWaveData();
    const state = clearingState(data, { waveIndex: 1 });

    const { events, state: next } = resolveTurn(state, data);

    expectEventSequence(events, [
      { type: 'WaveCleared', waveIndex: 1 },
      { type: 'CoinsChanged', reason: 'waveCleared' },
      { type: 'RunWon' },
    ]);
    expect(events.some((e) => e.type === 'TilesGranted')).toBe(false);
    expect(next.phase).toBe('won');
  });

  it('base HP <= 0 on the turn the wave would clear loses instead, with no WaveCleared', () => {
    const data = twoWaveData();
    const state = clearingState(data, {
      baseHp: 5,
      cannonBaseValue: 0,
      board: {
        cannons: [false, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [robot({ col: 1, hp: 5, maxHp: 5 })],
      },
    });

    const { events, state: next } = resolveTurn(state, data);

    expectEventSequence(events, [
      { type: 'RobotDetonated', damage: 5 },
      { type: 'BaseDamaged', hpBefore: 5, hpAfter: 0 },
      { type: 'RunLost' },
    ]);
    expect(events.some((e) => e.type === 'WaveCleared')).toBe(false);
    expect(next.phase).toBe('lost');
  });
});

describe('resolveTurn — mode: run — exactKills (GDD §10.6)', () => {
  it('increments exactKills on an exact kill', () => {
    // The exact kill empties the board, which also satisfies wave clear (GDD §10.3) — use
    // `twoWaveData()` so END CHECK has a real wave to look up (irrelevant to this assertion).
    const data = twoWaveData();
    const state = runState({
      exactKills: 2,
      cannonBaseValue: 5,
      board: {
        cannons: [true, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [robot({ hp: 5, maxHp: 5 })],
      },
    });

    const { state: next } = resolveTurn(state, data);
    expect(next.exactKills).toBe(3);
  });

  it('also increments in level mode (task 13 requirement 2: "in any mode")', () => {
    const data = fakeGameData();
    const levelDef = fakeLevelDef({
      cannonLanes: [0],
      baseValue: 5,
      robots: [{ lane: 0, col: 7, hp: 5, trait: { type: 'none' } }],
    });
    const state = buildLevelState(levelDef, data);

    const { state: next } = resolveTurn(state, data);
    expect(next.exactKills).toBe(1);
  });
});

describe('resolveTurn — mode: run — determinism and step/group ordering (TR §6, §7)', () => {
  function busyState(): RunState {
    return runState({
      turn: 3,
      baseHp: 100,
      cannonBaseValue: 5,
      pendingSpawns: [{ turn: 3, lane: 4, robotTemplateId: 'basic', hp: 2 }],
      board: {
        cannons: [true, false, false, false, true],
        cells: fakeRunState().board.cells,
        robots: [
          robot({ robotId: 'to-advance', lane: 0, col: 5, hp: 99, maxHp: 99 }),
          // Lane 2 has no cannon, so this robot survives FIRE untouched and reaches DETONATE.
          robot({ robotId: 'to-detonate', lane: 2, col: 1, hp: 3, maxHp: 3 }),
        ],
      },
    });
  }

  it('is deterministic: the same state resolves to a deep-equal result', () => {
    const data = fakeGameData({
      robots: [{ id: 'basic', trait: { type: 'none' }, isBoss: false }],
    });
    const state = busyState();

    const a = resolveTurn(structuredClone(state), data);
    const b = resolveTurn(structuredClone(state), data);

    expect(a).toEqual(b);
  });

  it('keeps `step` strictly increasing and groups ordered fire -> advance -> detonate -> end/spawn', () => {
    const data = fakeGameData({
      robots: [{ id: 'basic', trait: { type: 'none' }, isBoss: false }],
    });
    const state = busyState();

    const { events } = resolveTurn(state, data);

    const steps = events.map((e) => e.step);
    expect(steps).toEqual(events.map((_, i) => i));

    const groupFamily = (group: string) => group.split(':')[0]!;
    const seenOrder: string[] = [];
    for (const event of events) {
      const family = groupFamily(event.group);
      if (seenOrder[seenOrder.length - 1] !== family) seenOrder.push(family);
    }
    // fire groups appear as "fire" (family), then advance, then detonate, then spawn (no end
    // here — the wave doesn't clear in `busyState`).
    expect(seenOrder).toEqual(['fire', 'advance', 'detonate', 'spawn']);
  });

  it('ends on `end`, not `spawn`, when the turn instead finishes via END CHECK', () => {
    const data = twoWaveData();
    const state = runState({
      cannonBaseValue: 5,
      pendingSpawns: [],
      board: {
        cannons: [true, false, false, false, false],
        cells: fakeRunState().board.cells,
        robots: [robot({ hp: 5, maxHp: 5 })],
      },
    });

    const { events } = resolveTurn(state, data);

    const steps = events.map((e) => e.step);
    expect(steps).toEqual(events.map((_, i) => i));

    const groupFamily = (group: string) => group.split(':')[0]!;
    const seenOrder: string[] = [];
    for (const event of events) {
      const family = groupFamily(event.group);
      if (seenOrder[seenOrder.length - 1] !== family) seenOrder.push(family);
    }
    expect(seenOrder).toEqual(['fire', 'end']);
  });
});
