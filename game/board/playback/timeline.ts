// Playback timing (task 10, GDD §12.2): when each event's beat starts within its segment and how
// long the sequence waits on it. Every duration comes from `presentation.json`; nothing here reads
// or recomputes a game value. Phaser-free so the pacing target is unit-testable in node.

import type { GameEvent } from '../../../sim/core/types';
import type { GameData } from '../../../sim/data/schemas';
import { detonatingRobots, toSegments, type PlaybackSegment } from './segments';
import { tileKind } from './transformEffect';

/** Run-mode `"end"` event types (task 15 req. 5) — the short pause added to a run's `end`
 * segment. `LevelCleared` (level mode, task 11) is excluded: it plays its overlay once playback
 * goes idle, with no extra hold here. */
const RUN_END_TYPES = new Set<GameEvent['type']>(['WaveCleared', 'RunWon', 'RunLost']);

export type PresentationSettings = Pick<GameData['presentation'], 'pacing' | 'playback'>;

export interface TimedBeat {
  event: GameEvent;
  /** Start, in ms from the segment's start (after its lead-in). */
  atMs: number;
  durationMs: number;
}

export interface SegmentPlan {
  segment: PlaybackSegment;
  /** Pause before the segment's first beat (the lane gap). A tap during it skips this segment. */
  leadInMs: number;
  beats: TimedBeat[];
  /** Sum of the beat durations — the segment ends `leadInMs + totalMs` after it starts. */
  totalMs: number;
}

/** How long the sequence holds on one event's beat. */
export function beatDurationMs(
  event: GameEvent,
  segment: PlaybackSegment,
  presentation: PresentationSettings,
): number {
  const { pacing } = presentation;
  const { beats } = presentation.playback;
  switch (event.type) {
    case 'LaneStarted':
      return beats.laneStartMs;
    case 'BallFired':
      return beats.ballFireMs;
    case 'BallMoved':
      return segment.ballExits ? pacing.exitBallCellDurationMs : pacing.ballCellDurationMs;
    case 'BallTransformed':
      return tileKind(event.tileId) === 'mul' ? pacing.multiplyTilePauseMs : pacing.perTilePauseMs;
    case 'BallExited':
      return beats.exitMs;
    case 'BallBlocked':
      return beats.blockedMs;
    case 'RobotDamaged':
      return beats.impactMs;
    case 'RobotBouncedBack':
      return beats.bounceBackMs;
    case 'RobotDefeated':
      return event.exact ? beats.exactKillMs : beats.defeatMs;
    case 'CoinsChanged':
      return beats.coinsMs;
    case 'LaneEnded':
      return beats.laneEndMs;
    case 'RobotAdvanced':
      // Every `advance`-segment beat holds for the same duration — all robots move together
      // (task 15 req. 2).
      return pacing.advanceDurationMs;
    case 'RobotDetonated':
      // In the `advance` segment this is a borrowed event (task 15, `detonatingRobots`): the
      // robot lurches from column 1 into the base strip in the same beat as any follower. In its
      // own `detonate:<lane>` segment it plays the real flash/shake/HP-fly beat.
      return segment.group === 'advance' ? pacing.advanceDurationMs : beats.detonateMs;
    case 'BaseDamaged':
      return beats.baseCountDownMs;
    case 'RobotSpawned':
    case 'RobotWaiting':
      return beats.spawnMs;
    default:
      // No beat yet for `LevelCleared` (task 11 shows its overlay once playback is idle).
      return 0;
  }
}

/** Beats play one after another, in `step` order. A run-mode `end` segment (wave cleared / won /
 * lost) holds for one extra short pause after its (zero-duration) events, so playback doesn't
 * jump straight to idle (task 15 req. 5). */
export function planSegment(
  segment: PlaybackSegment,
  presentation: PresentationSettings,
  leadInMs: number,
): SegmentPlan {
  let atMs = 0;
  const beats = segment.events.map((event) => {
    const durationMs = beatDurationMs(event, segment, presentation);
    const beat = { event, atMs, durationMs };
    atMs += durationMs;
    return beat;
  });
  const isRunEnd = segment.group === 'end' && segment.events.some((e) => RUN_END_TYPES.has(e.type));
  const totalMs = isRunEnd ? atMs + presentation.playback.beats.endMs : atMs;
  return { segment, leadInMs, beats, totalMs };
}

/** The `advance` segment (task 15 req. 2): every beat starts at once (`atMs: 0`) and holds for
 * `pacing.advanceDurationMs` — real `RobotAdvanced` events plus any borrowed `RobotDetonated`
 * events (a robot leaving column 1 lurches into the base strip in the same beat, `segments.ts`'s
 * `detonatingRobots`). */
function planAdvanceSegment(
  segment: PlaybackSegment,
  presentation: PresentationSettings,
): SegmentPlan {
  const beats = segment.events.map((event) => ({
    event,
    atMs: 0,
    durationMs: beatDurationMs(event, segment, presentation),
  }));
  const totalMs = beats.reduce((max, beat) => Math.max(max, beat.durationMs), 0);
  return { segment, leadInMs: 0, beats, totalMs };
}

/** The whole turn: segments in order, each lane after the first preceded by the lane gap. The
 * `advance` segment always carries this turn's detonating robots too (task 15 req. 2), even when
 * no robot actually moved (everyone on the board was already on column 1) — `advance`'s own
 * events would then be empty and the group wouldn't appear in `toSegments`'s output at all, so one
 * is synthesised right before the first `detonate:<lane>` segment. */
export function planPlayback(
  events: readonly GameEvent[],
  presentation: PresentationSettings,
): SegmentPlan[] {
  const detonating = detonatingRobots(events);
  let lanesSeen = 0;
  let advancePlaced = detonating.length === 0;
  const plans: SegmentPlan[] = [];

  for (const segment of toSegments(events)) {
    if (segment.group === 'advance') {
      const merged: PlaybackSegment = { ...segment, events: [...segment.events, ...detonating] };
      plans.push(planAdvanceSegment(merged, presentation));
      advancePlaced = true;
      continue;
    }
    if (!advancePlaced && segment.group.startsWith('detonate:')) {
      const synthesised: PlaybackSegment = {
        group: 'advance',
        lane: null,
        events: [...detonating],
        ballExits: false,
      };
      plans.push(planAdvanceSegment(synthesised, presentation));
      advancePlaced = true;
    }
    const isLane = segment.lane !== null;
    const leadInMs = isLane && lanesSeen > 0 ? presentation.pacing.laneGapMs : 0;
    if (isLane) lanesSeen += 1;
    plans.push(planSegment(segment, presentation, leadInMs));
  }
  return plans;
}
