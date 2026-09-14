// Playback timing (task 10, GDD §12.2): when each event's beat starts within its segment and how
// long the sequence waits on it. Every duration comes from `presentation.json`; nothing here reads
// or recomputes a game value. Phaser-free so the pacing target is unit-testable in node.

import type { GameEvent } from '../../../sim/core/types';
import type { GameData } from '../../../sim/data/schemas';
import { toSegments, type PlaybackSegment } from './segments';

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
      return pacing.perTilePauseMs;
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
    default:
      // No beat yet for M2+ events (advance, detonate, spawn, …) or `LevelCleared` (task 11
      // shows its overlay once playback is idle).
      return 0;
  }
}

/** Beats play one after another, in `step` order. */
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
  return { segment, leadInMs, beats, totalMs: atMs };
}

/** The whole turn: segments in order, each lane after the first preceded by the lane gap. */
export function planPlayback(
  events: readonly GameEvent[],
  presentation: PresentationSettings,
): SegmentPlan[] {
  let lanesSeen = 0;
  return toSegments(events).map((segment) => {
    const isLane = segment.lane !== null;
    const leadInMs = isLane && lanesSeen > 0 ? presentation.pacing.laneGapMs : 0;
    if (isLane) lanesSeen += 1;
    return planSegment(segment, presentation, leadInMs);
  });
}
