import { describe, expect, it } from 'vitest';
import { toSegments } from '../../game/board/playback/segments';
import { beatDurationMs, planPlayback } from '../../game/board/playback/timeline';
import { applyCommand } from '../../sim/commands';
import type { GameEvent } from '../../sim/core/types';
import { fakePacingSettings, fakePlaybackSettings } from '../helpers/playbackSettings';
import { boardState, realData } from './boardFixtures';

const fake = { pacing: fakePacingSettings(), playback: fakePlaybackSettings() };
const EMPTY = '. . . . . . . .';

/** Resolves one End Turn (cannon base value 3) on a board built from scenario rows. */
function endTurnEvents(rows: string[]): GameEvent[] {
  const result = applyCommand(boardState(rows), { type: 'endTurn' }, realData);
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
