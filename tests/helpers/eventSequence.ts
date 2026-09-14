// Ordered-subsequence event matcher (task 07 ruling, TR §7 note: "Tests assert on events with a
// helper that matches an ordered subsequence of partial events"). Every entry in `expected` must
// appear, in order, as a partial match of some event in `actual` — unrelated events before,
// between, or after a match are allowed, so tests don't break when unrelated events are added.
//
// Pure and self-contained — no test-framework dependency — so task 08 can move this matching
// core into `/sim/scenario` unchanged; test files add only the `expect(...)` call
// (`expectEventSequence` below).

import { expect } from 'vitest';
import type { GameEvent } from '../../sim/core/types';

/** Only the given keys are checked against the real event; any other keys the real event has are
 * ignored. Nested objects (e.g. `at`, `from`, `to`) are matched key-by-key the same way. */
export type ExpectedEvent = { type: GameEvent['type'] } & Record<string, unknown>;

export interface EventSequenceMatch {
  ok: boolean;
  /** Index into `expected` of the first entry that could not be matched, or -1 if `ok`. */
  failedAt: number;
}

/** Pure matcher: true (well, `{ ok: true }`) iff every entry of `expected` matches, in order,
 * some event of `actual`. */
export function matchEventSequence(
  actual: readonly GameEvent[],
  expected: readonly ExpectedEvent[],
): EventSequenceMatch {
  let cursor = 0;
  for (let i = 0; i < expected.length; i++) {
    const want = expected[i]!;
    while (cursor < actual.length && !partialMatches(actual[cursor], want)) {
      cursor++;
    }
    if (cursor >= actual.length) {
      return { ok: false, failedAt: i };
    }
    cursor++; // consume this event so later expectations can't reuse it.
  }
  return { ok: true, failedAt: -1 };
}

function partialMatches(actual: unknown, expected: unknown): boolean {
  if (typeof expected !== 'object' || expected === null) {
    return Object.is(actual, expected);
  }
  if (typeof actual !== 'object' || actual === null) {
    return false;
  }
  return Object.entries(expected).every(([key, value]) =>
    partialMatches((actual as Record<string, unknown>)[key], value),
  );
}

function describeFailure(
  actual: readonly GameEvent[],
  expected: readonly ExpectedEvent[],
  match: EventSequenceMatch,
): string {
  return (
    `expected event ${JSON.stringify(expected[match.failedAt])} ` +
    `(position ${match.failedAt} of the sequence) not found, in order, among:\n` +
    JSON.stringify(actual, null, 2)
  );
}

/** Asserts `actual` contains `expected` as an ordered subsequence of partial matches. */
export function expectEventSequence(
  actual: readonly GameEvent[],
  expected: readonly ExpectedEvent[],
): void {
  const match = matchEventSequence(actual, expected);
  expect(match.ok, match.ok ? undefined : describeFailure(actual, expected, match)).toBe(true);
}
