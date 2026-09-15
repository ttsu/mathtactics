import { describe, expect, it } from 'vitest';
import {
  bouncesBack,
  detonatingRobots,
  isHudEvent,
  lastCellBefore,
  laneOfGroup,
  toSegments,
} from '../../game/board/playback/segments';
import { applyCommand } from '../../sim/commands';
import type { GameEvent } from '../../sim/core/types';
import { boardState, realData, runState } from './boardFixtures';

/** Resolves one End Turn (cannon base value 3) on a board built from scenario rows and returns its events. */
function endTurnEvents(rows: string[]): GameEvent[] {
  const result = applyCommand(boardState(rows), { type: 'endTurn' }, realData);
  if (!result.ok) throw new Error(result.error);
  return result.events;
}

const RUN_WAVES = [
  'waves:',
  '  - id: only-wave',
  '    spawns:',
  '      - { turn: 1, lane: 0, robot: basic, hp: [1, 1] }',
];

/** Resolves one End Turn on a `mode: run` board (task 15) and returns its events. */
function endTurnEventsRun(rows: string[], extraYaml: string[] = []): GameEvent[] {
  const result = applyCommand(
    runState(rows, [...extraYaml, ...RUN_WAVES]),
    { type: 'endTurn' },
    realData,
  );
  if (!result.ok) throw new Error(result.error);
  return result.events;
}

const EMPTY = '. . . . . . . .';

describe('laneOfGroup', () => {
  it('reads the lane from fire:lane:<n> groups only', () => {
    expect(laneOfGroup('fire:lane:0')).toBe(0);
    expect(laneOfGroup('fire:lane:4')).toBe(4);
    expect(laneOfGroup('fire:lane:5')).toBeNull();
    expect(laneOfGroup('end')).toBeNull();
    expect(laneOfGroup('advance')).toBeNull();
  });
});

describe('toSegments', () => {
  it('returns armed lanes top to bottom, then the end group, skipping unarmed lanes', () => {
    const events = endTurnEvents([
      'C +1 . R9 . . . .', // lane 0: 3 + 1 = 4 damage, survives
      EMPTY, // lane 1: unarmed
      'C . . . . . . .', // lane 2: ball exits
      EMPTY,
      'C x2 . . R9 . . .', // lane 4: 3 × 2 = 6 damage, survives
    ]);
    const segments = toSegments(events);
    expect(segments.map((s) => s.group)).toEqual(['fire:lane:0', 'fire:lane:2', 'fire:lane:4']);
    expect(segments.map((s) => s.lane)).toEqual([0, 2, 4]);
    expect(segments.map((s) => s.ballExits)).toEqual([false, true, false]);
    // Every event lands in exactly one segment, in step order within it.
    expect(segments.flatMap((s) => s.events)).toEqual(events);
    for (const segment of segments) {
      expect(segment.events[0]!.type).toBe('LaneStarted');
      expect(segment.events.at(-1)!.type).toBe('LaneEnded');
    }
  });

  it('puts LevelCleared in a trailing end segment after the last lane', () => {
    const events = endTurnEvents([EMPTY, EMPTY, 'C . . R1 . . . .', EMPTY, EMPTY]);
    const segments = toSegments(events);
    expect(segments.map((s) => s.group)).toEqual(['fire:lane:2', 'end']);
    expect(segments[1]).toMatchObject({ lane: null, ballExits: false });
    expect(segments[1]!.events.map((e) => e.type)).toEqual(['LevelCleared']);
  });

  it('orders by step and merges a group that reappears later', () => {
    const events: GameEvent[] = [
      { step: 3, group: 'end', type: 'LevelCleared', levelId: 'x' },
      { step: 2, group: 'fire:lane:1', type: 'LaneEnded', lane: 1 },
      { step: 0, group: 'fire:lane:1', type: 'LaneStarted', lane: 1 },
      { step: 1, group: 'advance', type: 'WaveCleared', waveIndex: 0 },
      { step: 4, group: 'advance', type: 'WaveCleared', waveIndex: 1 },
    ];
    const segments = toSegments(events);
    expect(segments.map((s) => s.group)).toEqual(['fire:lane:1', 'advance', 'end']);
    expect(segments[0]!.events.map((e) => e.step)).toEqual([0, 2]);
    expect(segments[1]!.events.map((e) => e.step)).toEqual([1, 4]);
  });

  it('returns no segments for no events', () => {
    expect(toSegments([])).toEqual([]);
  });
});

describe('isHudEvent', () => {
  it('flags CoinsChanged, BaseDamaged and WaveCleared only', () => {
    const events = endTurnEvents([EMPTY, EMPTY, 'C . . R1 . . . .', EMPTY, EMPTY]);
    expect(events.filter(isHudEvent).map((e) => e.type)).toEqual(['CoinsChanged']);
    expect(
      isHudEvent({ step: 0, group: 'x', type: 'BaseDamaged', amount: 1, hpBefore: 2, hpAfter: 1 }),
    ).toBe(true);
    expect(isHudEvent({ step: 0, group: 'x', type: 'WaveCleared', waveIndex: 0 })).toBe(true);
  });
});

describe('bouncesBack', () => {
  it('is true only when a RobotBouncedBack for the same robot follows the damage', () => {
    const [overshoot] = toSegments(
      endTurnEvents([EMPTY, EMPTY, 'C x5 R3:bb . . . . .', EMPTY, EMPTY]),
    );
    const damaged = overshoot!.events.find((e) => e.type === 'RobotDamaged')!;
    expect(bouncesBack(overshoot!, damaged as Extract<GameEvent, { type: 'RobotDamaged' }>)).toBe(
      true,
    );

    const [short] = toSegments(endTurnEvents([EMPTY, EMPTY, 'C . R3:bb . . . . .', EMPTY, EMPTY]));
    const shortHit = short!.events.find((e) => e.type === 'RobotDamaged')!;
    expect(bouncesBack(short!, shortHit as Extract<GameEvent, { type: 'RobotDamaged' }>)).toBe(
      false,
    );
  });
});

describe('lastCellBefore', () => {
  it('finds where the kill happened for the coin reward that follows it', () => {
    const [segment] = toSegments(endTurnEvents([EMPTY, EMPTY, 'C . . R1 . . . .', EMPTY, EMPTY]));
    const coins = segment!.events.find((e) => e.type === 'CoinsChanged')!;
    expect(lastCellBefore(segment!, coins.step)).toEqual({ lane: 2, col: 3 });
    expect(lastCellBefore(segment!, segment!.events[0]!.step)).toBeNull();
  });
});

describe('detonatingRobots', () => {
  const RUN_EMPTY = ['. . . . . . . .', '. . . . . . . .', '. . . . . . . .', '. . . . . . . .'];

  it('is empty when nothing detonates', () => {
    const events = endTurnEventsRun([EMPTY, ...RUN_EMPTY], [
      'pendingSpawns:',
      '  - { turn: 99, lane: 4, hp: 1 }',
    ]);
    expect(detonatingRobots(events)).toEqual([]);
  });

  it('finds every RobotDetonated in the turn, one per detonating robot', () => {
    // Lane 2's robot is already on column 1: it detonates with no other mover. Lane 4's stays
    // "open" via a far-future pending spawn so this turn doesn't also wave-clear.
    const events = endTurnEventsRun(
      ['. . . . . . . .', '. . . . . . . .', '. R7 . . . . . .', '. . . . . . . .', '. . . . . . . .'],
      ['pendingSpawns:', '  - { turn: 99, lane: 4, hp: 1 }'],
    );
    const detonated = detonatingRobots(events);
    expect(detonated).toHaveLength(1);
    expect(detonated[0]).toMatchObject({ type: 'RobotDetonated', lane: 2, damage: 7 });
  });

  it('finds one entry per lane when several robots detonate the same turn', () => {
    const events = endTurnEventsRun(
      ['. R4 . . . . . .', '. . . . . . . .', '. . . . . . . .', '. R6 . . . . . .', '. . . . . . . .'],
      ['pendingSpawns:', '  - { turn: 99, lane: 2, hp: 1 }'],
    );
    const detonated = detonatingRobots(events);
    expect(detonated.map((e) => [e.lane, e.damage])).toEqual([
      [0, 4],
      [3, 6],
    ]);
  });
});
