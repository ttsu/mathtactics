// FIRE / resolveTurn (GDD §3.5, §4, §5; TR §6, §7) — event-list assertions via the
// ordered-subsequence matcher (task 07 ruling).

import { describe, expect, it } from 'vitest';
import { resolveTurn } from '../../../sim/resolve/resolveTurn';
import { buildLevelState } from '../../../sim/commands/level';
import { fakeGameData, fakeLevelDef, fakeTile } from '../../sim/commands/fixtures';
import { expectEventSequence } from '../../helpers/eventSequence';
import type { GameEvent } from '../../../sim/core/types';

describe('resolveTurn — FIRE, order of operations', () => {
  it('(1 + 4) x 3 - 2 = 13 -> exact kill; chainDepth 1, 2, 3', () => {
    const data = fakeGameData({
      tiles: [
        fakeTile({ id: 'add:4', n: 4 }),
        fakeTile({ id: 'mul:3', kind: 'mul', n: 3, priceCategory: 'mulLow' }),
        fakeTile({ id: 'sub:2', kind: 'sub', n: 2, priceCategory: 'sub' }),
      ],
    });
    const levelDef = fakeLevelDef({
      cannonLanes: [0],
      baseValue: 1,
      boardTiles: [
        { lane: 0, col: 1, tileId: 'add:4' },
        { lane: 0, col: 2, tileId: 'mul:3' },
        { lane: 0, col: 3, tileId: 'sub:2' },
      ],
      robots: [{ lane: 0, col: 5, hp: 13, trait: { type: 'none' } }],
    });
    const state = buildLevelState(levelDef, data);

    const { events } = resolveTurn(state, data);

    expectEventSequence(events, [
      { type: 'LaneStarted', lane: 0 },
      { type: 'BallFired', lane: 0, value: 1 },
      {
        type: 'BallTransformed',
        at: { lane: 0, col: 1 },
        tileId: 'add:4',
        oldValue: 1,
        newValue: 5,
        chainDepth: 1,
      },
      {
        type: 'BallTransformed',
        at: { lane: 0, col: 2 },
        tileId: 'mul:3',
        oldValue: 5,
        newValue: 15,
        chainDepth: 2,
      },
      {
        type: 'BallTransformed',
        at: { lane: 0, col: 3 },
        tileId: 'sub:2',
        oldValue: 15,
        newValue: 13,
        chainDepth: 3,
      },
      {
        type: 'RobotDamaged',
        at: { lane: 0, col: 5 },
        ballValue: 13,
        damage: 13,
        hpBefore: 13,
        hpAfter: 0,
      },
      { type: 'RobotDefeated', at: { lane: 0, col: 5 }, exact: true },
      { type: 'CoinsChanged', reason: 'exactKill' },
      { type: 'LaneEnded', lane: 0 },
    ]);
  });

  it('a robot standing on a tile is not affected by that tile', () => {
    const data = fakeGameData();
    const levelDef = fakeLevelDef({
      cannonLanes: [0],
      baseValue: 100,
      boardTiles: [{ lane: 0, col: 3, tileId: 'add:5' }],
      robots: [{ lane: 0, col: 3, hp: 100, trait: { type: 'none' } }],
    });
    const state = buildLevelState(levelDef, data);

    const { events } = resolveTurn(state, data);

    const transformed = events.filter((e) => e.type === 'BallTransformed');
    expect(transformed).toHaveLength(0);
    expectEventSequence(events, [
      { type: 'RobotDamaged', ballValue: 100, damage: 100, hpAfter: 0 },
      { type: 'RobotDefeated', exact: true },
    ]);
  });

  it('tiles beyond the first robot do not apply; the second robot is untouched', () => {
    const data = fakeGameData();
    const levelDef = fakeLevelDef({
      cannonLanes: [0],
      baseValue: 1,
      boardTiles: [{ lane: 0, col: 5, tileId: 'add:5' }],
      robots: [
        { lane: 0, col: 3, hp: 1, trait: { type: 'none' } },
        { lane: 0, col: 6, hp: 9, trait: { type: 'none' } },
      ],
    });
    const state = buildLevelState(levelDef, data);

    const { state: nextState, events } = resolveTurn(state, data);

    expect(events.some((e) => e.type === 'BallTransformed')).toBe(false);
    const secondRobot = nextState.board.robots.find((r) => r.hp === 9);
    expect(secondRobot).toBeDefined();
    expect(secondRobot?.hp).toBe(9);
    // The killed robot (col 3, 1 HP) is gone; only the untouched robot remains.
    expect(nextState.board.robots).toHaveLength(1);
  });

  it('an unarmed lane fires nothing', () => {
    const data = fakeGameData();
    const levelDef = fakeLevelDef({ cannonLanes: [], robots: [] });
    const state = buildLevelState(levelDef, data);

    const { events } = resolveTurn(state, data);

    expect(events.filter((e) => e.type === 'LaneStarted')).toHaveLength(0);
  });

  it('a lane with no robot in reach emits BallExited', () => {
    const data = fakeGameData();
    const levelDef = fakeLevelDef({ cannonLanes: [0], robots: [] });
    const state = buildLevelState(levelDef, data);

    const { events } = resolveTurn(state, data);

    expectEventSequence(events, [
      { type: 'LaneStarted', lane: 0 },
      { type: 'BallFired', lane: 0 },
      { type: 'BallExited', lane: 0, at: { lane: 0, col: 7 } },
      { type: 'LaneEnded', lane: 0 },
    ]);
  });

  it('fires lanes 0 -> 4 in order with a strictly increasing step across the whole resolution', () => {
    const data = fakeGameData();
    const levelDef = fakeLevelDef({
      cannonLanes: [4, 0, 2],
      robots: [{ lane: 0, col: 7, hp: 1, trait: { type: 'none' } }],
    });
    const state = buildLevelState(levelDef, data);

    const { events } = resolveTurn(state, data);

    const laneOrder = events
      .filter((e): e is Extract<GameEvent, { type: 'LaneStarted' }> => e.type === 'LaneStarted')
      .map((e) => e.lane);
    expect(laneOrder).toEqual([0, 2, 4]);

    const steps = events.map((e) => e.step);
    expect(steps).toEqual(events.map((_, i) => i));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]!);
    }
  });

  it('pays exactKill (+2) and kill (+1) coins from economy.json income values', () => {
    const data = fakeGameData({
      economy: { ...fakeGameData().economy, income: { kill: 1, exactKill: 2, waveCleared: 3 } },
    });
    const levelDef = fakeLevelDef({
      cannonLanes: [0, 1],
      baseValue: 5,
      robots: [
        { lane: 0, col: 7, hp: 5, trait: { type: 'none' } }, // exact kill
        { lane: 1, col: 7, hp: 3, trait: { type: 'none' } }, // overkill
      ],
    });
    const state = buildLevelState(levelDef, data);

    const { events, state: nextState } = resolveTurn(state, data);

    expectEventSequence(events, [
      { type: 'CoinsChanged', reason: 'exactKill', delta: 2 },
      { type: 'CoinsChanged', reason: 'kill', delta: 1 },
    ]);
    expect(nextState.coins).toBe(3);
  });

  it('clears the level and emits LevelCleared (group "end") when the last robot dies', () => {
    const data = fakeGameData();
    const levelDef = fakeLevelDef({
      cannonLanes: [0],
      baseValue: 5,
      robots: [{ lane: 0, col: 7, hp: 5, trait: { type: 'none' } }],
    });
    const state = buildLevelState(levelDef, data);

    const { state: nextState, events } = resolveTurn(state, data);

    expect(nextState.phase).toBe('levelCleared');
    expect(nextState.board.robots).toHaveLength(0);
    const last = events[events.length - 1];
    expect(last).toMatchObject({ type: 'LevelCleared', group: 'end', levelId: levelDef.id });
  });

  it('clears undo and stores lastTurnEvents on the resulting state', () => {
    const data = fakeGameData();
    const levelDef = fakeLevelDef({ cannonLanes: [0], robots: [] });
    let state = buildLevelState(levelDef, data);
    state = {
      ...state,
      undo: [{ cells: state.board.cells, tray: [], cannons: state.board.cannons }],
    };

    const { state: nextState, events } = resolveTurn(state, data);

    expect(nextState.undo).toEqual([]);
    expect(nextState.lastTurnEvents).toEqual(events);
  });
});
