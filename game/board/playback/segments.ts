// Groups a resolved turn's event list into playback segments (TR §7, §11.4): one segment per
// `group`, in the order the groups first occur. Phaser-free so it is unit-testable in node.
//
// No game rules here — segments only re-arrange events the simulation already produced.

import type { Cell, Lane } from '../../../sim/core/coords';
import { LANES } from '../../../sim/core/coords';
import type { GameEvent } from '../../../sim/core/types';

export interface PlaybackSegment {
  group: string;
  /** The lane for a `fire:lane:<n>` group, otherwise `null`. */
  lane: Lane | null;
  /** This group's events, in `step` order. */
  events: GameEvent[];
  /** A lane whose ball left the board without reaching a robot — played quickly (task 10 req. 2). */
  ballExits: boolean;
}

const LANE_GROUP = /^fire:lane:(\d+)$/;

/** The lane a `fire:lane:<n>` group belongs to, or `null` for any other group. */
export function laneOfGroup(group: string): Lane | null {
  const match = LANE_GROUP.exec(group);
  if (match === null) return null;
  const lane = Number(match[1]);
  return lane < LANES ? (lane as Lane) : null;
}

/** Events sharing a `group` form one segment; segments play in order of each group's first
 * `step`. Events are sorted by `step` first, so an out-of-order list still plays correctly. */
export function toSegments(events: readonly GameEvent[]): PlaybackSegment[] {
  const sorted = [...events].sort((a, b) => a.step - b.step);
  const byGroup = new Map<string, GameEvent[]>();
  for (const event of sorted) {
    const list = byGroup.get(event.group);
    if (list === undefined) byGroup.set(event.group, [event]);
    else list.push(event);
  }
  return [...byGroup].map(([group, groupEvents]) => ({
    group,
    lane: laneOfGroup(group),
    events: groupEvents,
    ballExits: groupEvents.some((event) => event.type === 'BallExited'),
  }));
}

export type HudEvent = Extract<GameEvent, { type: 'CoinsChanged' | 'BaseDamaged' | 'WaveCleared' }>;

/** Events the HUD commits via `store.commitEvent` when their beat plays (TR §10 flow step 3). */
export function isHudEvent(event: GameEvent): event is HudEvent {
  return (
    event.type === 'CoinsChanged' || event.type === 'BaseDamaged' || event.type === 'WaveCleared'
  );
}

/** True when `damaged` is followed, in the same segment, by a `RobotBouncedBack` for the same
 * robot — the damage beat then drains the HP bar and the bounce beat refills it. */
export function bouncesBack(
  segment: PlaybackSegment,
  damaged: Extract<GameEvent, { type: 'RobotDamaged' }>,
): boolean {
  return segment.events.some(
    (event) =>
      event.type === 'RobotBouncedBack' &&
      event.robotId === damaged.robotId &&
      event.step > damaged.step,
  );
}

/** Where the most recent located event before `step` happened in this segment — e.g. where a
 * coin reward should float up from (a `CoinsChanged` carries no cell of its own). */
export function lastCellBefore(segment: PlaybackSegment, step: number): Cell | null {
  let cell: Cell | null = null;
  for (const event of segment.events) {
    if (event.step >= step) break;
    if ('at' in event) cell = event.at;
  }
  return cell;
}

/** Every `RobotDetonated` event in a resolved turn's full event list (task 15, GDD §12.2 step 4)
 * — "will detonate" derivation. `resolveTurn` runs ADVANCE and DETONATE at most once each per
 * turn, so any robot detonating this turn is queued by that same ADVANCE sweep: the `advance`
 * segment shows it lurching from column 1 into the base strip (instead of just vanishing), in the
 * same beat as any `RobotAdvanced` follower moving into its now-empty cell — so the two never
 * occupy column 1 at once. */
export function detonatingRobots(
  events: readonly GameEvent[],
): Extract<GameEvent, { type: 'RobotDetonated' }>[] {
  return events.filter(
    (event): event is Extract<GameEvent, { type: 'RobotDetonated' }> =>
      event.type === 'RobotDetonated',
  );
}
