import { describe, expect, it } from 'vitest';
import { detonatingRobots, toSegments, type PlaybackSegment } from '../../game/board/playback/segments';
import { beatDurationMs, planPlayback, planSegment } from '../../game/board/playback/timeline';
import { applyCommand } from '../../sim/commands';
import type { GameEvent } from '../../sim/core/types';
import { fakePacingSettings, fakePlaybackSettings } from '../helpers/playbackSettings';
import { boardState, realData, runState } from './boardFixtures';

const fake = { pacing: fakePacingSettings(), playback: fakePlaybackSettings() };
const EMPTY = '. . . . . . . .';

/** Resolves one End Turn (cannon base value 3) on a board built from scenario rows. */
function endTurnEvents(rows: string[]): GameEvent[] {
  const result = applyCommand(boardState(rows), { type: 'endTurn' }, realData);
  if (!result.ok) throw new Error(result.error);
  return result.events;
}

/** Resolves one End Turn on a `mode: run` board (task 15), with a placeholder `waves:` list (only
 * `nextWave`/`newRun` ever read it — `endTurn` doesn't) unless the test supplies its own. */
function endTurnEventsRun(rows: string[], extraYaml: string[] = []): GameEvent[] {
  const needsWaves = !extraYaml.some((line) => line.startsWith('waves:'));
  const waves = needsWaves
    ? [
        'waves:',
        '  - id: only-wave',
        '    spawns:',
        '      - { turn: 1, lane: 0, robot: basic, hp: [1, 1] }',
      ]
    : [];
  const result = applyCommand(runState(rows, [...extraYaml, ...waves]), { type: 'endTurn' }, realData);
  if (!result.ok) throw new Error(result.error);
  return result.events;
}

describe('planPlayback', () => {
  it('lays beats end to end in step order, with the lane gap before every lane but the first', () => {
    const events = endTurnEvents(['C . R9 . . . . .', EMPTY, 'C . . . . . . .', EMPTY, EMPTY]);
    const plans = planPlayback(events, fake);
    expect(plans.map((p) => p.segment.group)).toEqual(['fire:lane:0', 'fire:lane:2']);
    expect(plans.map((p) => p.leadInMs)).toEqual([0, fake.pacing.laneGapMs]);
    for (const plan of plans) {
      let at = 0;
      for (const beat of plan.beats) {
        expect(beat.atMs).toBe(at);
        at += beat.durationMs;
      }
      expect(plan.totalMs).toBe(at);
    }
  });

  it('gives the end segment no lead-in', () => {
    const events = endTurnEvents([EMPTY, EMPTY, 'C . R1 . . . . .', EMPTY, 'C . . . . . . .']);
    const plans = planPlayback(events, fake);
    expect(plans.map((p) => [p.segment.group, p.leadInMs])).toEqual([
      ['fire:lane:2', 0],
      ['fire:lane:4', fake.pacing.laneGapMs],
      ['end', 0],
    ]);
    expect(plans[2]!.totalMs).toBe(0);
  });

  it('a ball that exits travels at the quicker exit pacing', () => {
    const events = endTurnEvents([EMPTY, EMPTY, 'C +2 . . . . . .', EMPTY, 'C . R9 . . . . .']);
    const [exits, hits] = planPlayback(events, fake);
    const moveDurations = (plan: typeof exits) =>
      plan!.beats.filter((b) => b.event.type === 'BallMoved').map((b) => b.durationMs);
    expect(new Set(moveDurations(exits))).toEqual(new Set([fake.pacing.exitBallCellDurationMs]));
    expect(new Set(moveDurations(hits))).toEqual(new Set([fake.pacing.ballCellDurationMs]));
  });

  it('an exact kill holds for the exact-kill beat, a normal kill for the defeat beat', () => {
    // Base value 3 into 3 HP: an exact kill.
    const [segment] = toSegments(endTurnEvents([EMPTY, EMPTY, 'C . R3 . . . . .', EMPTY, EMPTY]));
    const defeated = segment!.events.find((e) => e.type === 'RobotDefeated')!;
    expect(defeated).toMatchObject({ exact: true });
    const exact = beatDurationMs(defeated, segment!, fake);
    const normal = beatDurationMs({ ...defeated, exact: false }, segment!, fake);
    expect(exact).toBe(fake.playback.beats.exactKillMs);
    expect(normal).toBe(fake.playback.beats.defeatMs);
  });

  it('a ball holds longer on a × tile than on a + or − tile', () => {
    const events = endTurnEvents([EMPTY, EMPTY, 'C +4 x3 -2 . . . .', EMPTY, EMPTY]);
    const [lane] = planPlayback(events, fake);
    const holds = lane!.beats
      .filter((b) => b.event.type === 'BallTransformed')
      .map((b) => b.durationMs);
    expect(holds).toEqual([
      fake.pacing.perTilePauseMs,
      fake.pacing.multiplyTilePauseMs,
      fake.pacing.perTilePauseMs,
    ]);
  });

  it('meets GDD §12.2 with the real presentation.json: ~2–3 s for an active lane with 3 tiles', () => {
    const presentation = realData.presentation;
    // A robot at the far end, a normal (overkill) kill after a 3-tile chain.
    const events = endTurnEvents([EMPTY, EMPTY, 'C +4 x3 -2 . . . R5', EMPTY, EMPTY]);
    const [lane] = planPlayback(events, presentation);
    expect(lane!.segment.events.some((e) => e.type === 'RobotDefeated' && !e.exact)).toBe(true);
    expect(lane!.totalMs).toBeGreaterThanOrEqual(2000);
    expect(lane!.totalMs).toBeLessThanOrEqual(3000);

    // A lane whose ball rolls off with no robot is clearly quicker.
    const exitEvents = endTurnEvents([EMPTY, EMPTY, 'C +4 x3 -2 . . . .', EMPTY, EMPTY]);
    const [exitLane] = planPlayback(exitEvents, presentation);
    expect(exitLane!.totalMs).toBeLessThan(lane!.totalMs * 0.75);
  });
});

describe('planPlayback (run mode: advance, detonate, spawn, end — task 15)', () => {
  it('orders fire -> advance -> detonate:<lane> -> spawn for a full run-mode turn', () => {
    // Lane 0: a follower (col 2) advances into the detonator's (col 1) now-empty cell in the same
    // beat. Lane 4: an armed cannon whose ball just exits (no robot in reach). A turn-2 pending
    // spawn keeps the wave "open" (no wave-clear) and gives the turn a `spawn` segment too.
    const events = endTurnEventsRun(
      ['. R5 R3 . . . . .', EMPTY, EMPTY, EMPTY, 'C . . . . . . .'],
      ['pendingSpawns:', '  - { turn: 2, lane: 3, hp: 4 }'],
    );
    const plans = planPlayback(events, fake);
    expect(plans.map((p) => p.segment.group)).toEqual([
      'fire:lane:4',
      'advance',
      'detonate:0',
      'spawn',
    ]);

    const advance = plans[1]!;
    expect(advance.segment.events.map((e) => e.type).sort()).toEqual([
      'RobotAdvanced',
      'RobotDetonated',
    ]);
    // Every advance beat starts at once and holds for the same duration (req. 2).
    expect(advance.beats.map((b) => b.atMs)).toEqual([0, 0]);
    expect(advance.beats.map((b) => b.durationMs)).toEqual([
      fake.pacing.advanceDurationMs,
      fake.pacing.advanceDurationMs,
    ]);
    expect(advance.totalMs).toBe(fake.pacing.advanceDurationMs);

    const detonate = plans[2]!;
    expect(detonate.beats.map((b) => b.event.type)).toEqual(['RobotDetonated', 'BaseDamaged']);
    expect(detonate.beats.map((b) => b.durationMs)).toEqual([
      fake.playback.beats.detonateMs,
      fake.playback.beats.baseCountDownMs,
    ]);

    const spawn = plans[3]!;
    expect(spawn.beats.map((b) => b.event.type)).toEqual(['RobotSpawned']);
    expect(spawn.beats[0]!.durationMs).toBe(fake.playback.beats.spawnMs);
  });

  it('synthesises the advance segment when every on-board robot detonates and none move', () => {
    // Lane 2's lone robot is already on column 1: it detonates with no follower to advance, so
    // `advance`'s own event list is empty and the group never appears in `toSegments`'s output.
    const events = endTurnEventsRun(
      [EMPTY, EMPTY, '. R7 . . . . . .', EMPTY, EMPTY],
      ['pendingSpawns:', '  - { turn: 99, lane: 4, hp: 1 }'],
    );
    expect(toSegments(events).map((s) => s.group)).not.toContain('advance');

    const plans = planPlayback(events, fake);
    expect(plans.map((p) => p.segment.group)).toEqual(['advance', 'detonate:2', 'spawn']);
    const advance = plans[0]!;
    expect(advance.segment.events).toEqual(detonatingRobots(events));
    expect(advance.leadInMs).toBe(0);
    expect(advance.totalMs).toBe(fake.pacing.advanceDurationMs);
  });

  it('holds a run-mode end segment for the extra endMs pause; a level-mode LevelCleared gets none', () => {
    const runEnd: PlaybackSegment = {
      group: 'end',
      lane: null,
      ballExits: false,
      events: [{ step: 0, group: 'end', type: 'WaveCleared', waveIndex: 0 }],
    };
    const levelEnd: PlaybackSegment = {
      group: 'end',
      lane: null,
      ballExits: false,
      events: [{ step: 0, group: 'end', type: 'LevelCleared', levelId: 'x' }],
    };
    expect(planSegment(runEnd, fake, 0).totalMs).toBe(fake.playback.beats.endMs);
    expect(planSegment(levelEnd, fake, 0).totalMs).toBe(0);
  });

  it('beatDurationMs: detonate, base count-down and spawn/waiting durations', () => {
    const detonateSegment: PlaybackSegment = {
      group: 'detonate:0',
      lane: null,
      ballExits: false,
      events: [],
    };
    const advanceSegment: PlaybackSegment = { group: 'advance', lane: null, ballExits: false, events: [] };
    const detonated: GameEvent = { step: 0, group: 'detonate:0', type: 'RobotDetonated', robotId: 'r1', lane: 0, damage: 5 };
    expect(beatDurationMs(detonated, detonateSegment, fake)).toBe(fake.playback.beats.detonateMs);
    expect(beatDurationMs(detonated, advanceSegment, fake)).toBe(fake.pacing.advanceDurationMs);

    const baseDamaged: GameEvent = { step: 0, group: 'detonate:0', type: 'BaseDamaged', amount: 5, hpBefore: 10, hpAfter: 5 };
    expect(beatDurationMs(baseDamaged, detonateSegment, fake)).toBe(fake.playback.beats.baseCountDownMs);

    const spawnSegment: PlaybackSegment = { group: 'spawn', lane: null, ballExits: false, events: [] };
    const spawned: GameEvent = {
      step: 0,
      group: 'spawn',
      type: 'RobotSpawned',
      robotId: 'r2',
      at: { lane: 0, col: 7 },
      hp: 3,
      maxHp: 3,
      trait: { type: 'none' },
      isBoss: false,
    };
    const waiting: GameEvent = {
      step: 0,
      group: 'spawn',
      type: 'RobotWaiting',
      robotId: 'r3',
      lane: 1,
      hp: 3,
      maxHp: 3,
      trait: { type: 'none' },
    };
    expect(beatDurationMs(spawned, spawnSegment, fake)).toBe(fake.playback.beats.spawnMs);
    expect(beatDurationMs(waiting, spawnSegment, fake)).toBe(fake.playback.beats.spawnMs);
  });
});
