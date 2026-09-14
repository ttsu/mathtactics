// Ordered-subsequence event matcher (task 07 ruling, TR §7 note: "Tests assert on events with a
// helper that matches an ordered subsequence of partial events"). Every entry in `expected` must
// appear, in order, as a partial match of some event in `actual` — unrelated events before,
// between, or after a match are allowed, so tests don't break when unrelated events are added.
//
// The pure matching core (`matchEventSequence`, `partialMatches`) lives in `/sim/scenario/match.ts`
// (task 08 ruling) so the scenario runner can reuse it too. This file re-exports it unchanged and
// keeps only `expectEventSequence`, the thin `expect(...)` wrapper — the one thing here that
// actually needs vitest.

import { expect } from 'vitest';
import type { GameEvent } from '../../sim/core/types';
import {
  describeEventSequenceFailure,
  matchEventSequence,
  type EventSequenceMatch,
  type ExpectedEvent,
} from '../../sim/scenario/match';

export type { EventSequenceMatch, ExpectedEvent };
export { matchEventSequence };

/** Asserts `actual` contains `expected` as an ordered subsequence of partial matches. */
export function expectEventSequence(
  actual: readonly GameEvent[],
  expected: readonly ExpectedEvent[],
): void {
  const match = matchEventSequence(actual, expected);
  expect(match.ok, match.ok ? undefined : describeEventSequenceFailure(actual, expected, match)).toBe(
    true,
  );
}
