// Keyed reconciliation plans (task 09 req. 1): which sprites to keep, create, or destroy when the
// store changes, so the board updates views by id instead of re-creating everything. Phaser-free.

import type { Lane } from '../../sim/core/coords';

export interface KeyDiff<K> {
  added: K[];
  removed: K[];
  kept: K[];
}

export function diffKeys<K>(previous: Iterable<K>, next: Iterable<K>): KeyDiff<K> {
  const prevSet = new Set(previous);
  const nextSet = new Set(next);
  return {
    added: [...nextSet].filter((key) => !prevSet.has(key)),
    removed: [...prevSet].filter((key) => !nextSet.has(key)),
    kept: [...nextSet].filter((key) => prevSet.has(key)),
  };
}

export interface CannonPlan {
  kept: Lane[];
  /** A cannon view moves from one lane to another (a `moveCannon`, or its undo). */
  moved: { from: Lane; to: Lane }[];
  added: Lane[];
  removed: Lane[];
}

/**
 * Cannons are keyed by lane. When lanes are vacated and others armed in the same change, the
 * vacated cannon views are moved (in lane order) rather than destroyed and re-created, so a
 * dragged cannon settles into its new slot instead of vanishing and reappearing.
 */
export function planCannons(previousLanes: Iterable<Lane>, nextCannons: boolean[]): CannonPlan {
  const next = nextCannons.flatMap((armed, lane) => (armed ? [lane as Lane] : []));
  const diff = diffKeys(previousLanes, next);
  const vacated = [...diff.removed].sort((a, b) => a - b);
  const armed = [...diff.added].sort((a, b) => a - b);
  const pairs = Math.min(vacated.length, armed.length);
  return {
    kept: diff.kept,
    moved: vacated.slice(0, pairs).map((from, i) => ({ from, to: armed[i]! })),
    added: armed.slice(pairs),
    removed: vacated.slice(pairs),
  };
}
