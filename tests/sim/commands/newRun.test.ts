import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../../sim/commands/applyCommand';
import { createStreams } from '../../../sim/core/rng';
import type { GameEvent, RunState } from '../../../sim/core/types';
import { parseGameData } from '../../../sim/data/load';
import { rollWave } from '../../../sim/waves/rollWave';
import { loadRawGameData } from '../../helpers/loadDataFiles';

const data = parseGameData(loadRawGameData());

function newRun(state: RunState | null, seed: string): { state: RunState; events: GameEvent[] } {
  const result = applyCommand(state, { type: 'newRun', seed }, data);
  if (!result.ok) throw new Error(`expected ok, got error "${result.error}"`);
  return result;
}

describe('applyCommand — newRun', () => {
  it('builds the GDD §10.1 starting state from economy.json', () => {
    const { state } = newRun(null, 'start');
    const { economy } = data;

    expect(state).toMatchObject({
      schemaVersion: economy.schemaVersion,
      mode: 'run',
      seed: 'start',
      phase: 'planning',
      waveIndex: 0,
      turn: 1,
      baseHp: economy.baseHp,
      coins: economy.startCoins,
      cannonBaseValue: economy.startBaseValue,
      upgradesBought: 0,
      exactKills: 0,
      pieces: {},
      tray: [],
      undo: [],
      lastTurnEvents: [],
      shop: null,
    });
    expect(state.levelId).toBeUndefined();
    expect(state.board.cannons).toEqual([0, 1, 2, 3, 4].map((l) => l === economy.startCannonLane));
    expect(state.board.cells.flat().every((cell) => cell === null)).toBe(true);
    expect(state.board.cells).toHaveLength(5);
    expect(state.board.cells.every((row) => row.length === 8)).toBe(true);
  });

  it('spawns wave 1’s turn-1 robot at col 7 and returns its spawn event', () => {
    const { state, events } = newRun(null, 'first-robot');
    const expected = rollWave(data.waves.waves[0]!, createStreams('first-robot').wave);
    const [first, ...rest] = expected.spawns;

    expect(state.board.robots).toEqual([
      {
        robotId: 'robot:0',
        lane: first!.lane,
        col: 7,
        hp: first!.hp,
        maxHp: first!.hp,
        trait: { type: 'none' },
        isBoss: false,
      },
    ]);
    expect(state.pendingSpawns).toEqual(rest);
    expect(state.nextIds).toEqual({ robot: 1, piece: 0, ball: 0 });
    expect(events).toEqual([
      {
        step: 0,
        group: 'spawn',
        type: 'RobotSpawned',
        robotId: 'robot:0',
        at: { lane: first!.lane, col: 7 },
        hp: first!.hp,
        maxHp: first!.hp,
        trait: { type: 'none' },
        isBoss: false,
      },
    ]);
  });

  it('advances only the wave stream; the shop stream is freshly seeded', () => {
    const { state } = newRun(null, 'streams');
    const streams = createStreams('streams');
    const expected = rollWave(data.waves.waves[0]!, streams.wave);

    expect(state.rng.shop).toEqual(streams.shop);
    expect(state.rng.wave).toEqual(expected.rng);
    expect(streams.wave).not.toEqual(streams.shop);
  });

  it('replaces an existing level state', () => {
    const level = applyCommand(
      null,
      { type: 'loadLevel', levelId: data.levels.levels[0]!.id },
      data,
    );
    if (!level.ok) throw new Error('loadLevel failed');

    const fromLevel = newRun(level.state, 'same-seed');
    const fromNull = newRun(null, 'same-seed');

    expect(fromLevel).toEqual(fromNull);
  });

  it('is deterministic: the same seed gives deep-equal state', () => {
    expect(newRun(null, 'repeat')).toEqual(newRun(null, 'repeat'));
  });

  it('varies the lanes across seeds', () => {
    const laneSets = new Set(
      Array.from({ length: 30 }, (_, i) => {
        const { state } = newRun(null, `seed-${i}`);
        return JSON.stringify([
          state.board.robots[0]!.lane,
          ...state.pendingSpawns.map((s) => s.lane),
        ]);
      }),
    );
    expect(laneSets.size).toBeGreaterThan(1);
  });

  it('does not mutate the state it replaces', () => {
    const { state } = newRun(null, 'old');
    const snapshot = structuredClone(state);
    newRun(state, 'new');
    expect(state).toEqual(snapshot);
  });
});

describe('level state (task 12)', () => {
  it('starts with exactKills 0', () => {
    const level = applyCommand(
      null,
      { type: 'loadLevel', levelId: data.levels.levels[0]!.id },
      data,
    );
    if (!level.ok) throw new Error('loadLevel failed');
    expect(level.state.exactKills).toBe(0);
  });
});
