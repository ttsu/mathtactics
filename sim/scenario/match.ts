// Pure partial-match / event-sequence matching core (originally task 07's
// `tests/helpers/eventSequence.ts`; moved into `/sim/scenario` by task 08 so the scenario
// runner (`./run.ts`) and the vitest helper share one implementation — no test-framework
// dependency, so `/sim` can depend on it too (CLAUDE.md rule 1).
//
// `tests/helpers/eventSequence.ts` re-exports `matchEventSequence`/`ExpectedEvent`/
// `EventSequenceMatch` from here and keeps only `expectEventSequence`, the thin
// `expect(...)` wrapper that needs vitest.

import type { GameEvent } from '../core/types';

/** Only the given keys are checked against the real event; any other keys the real event has are
 * ignored. Nested objects (e.g. `at`, `from`, `to`) are matched key-by-key the same way. */
export type ExpectedEvent = { type: GameEvent['type'] } & Record<string, unknown>;

export interface EventSequenceMatch {
  ok: boolean;
  /** Index into `expected` of the first entry that could not be matched, or -1 if `ok`. */
  failedAt: number;
}

/** Where a partial match first failed: the dot/bracket path into `expected`, and the expected vs.
 * actual value found there. */
export interface PartialMismatch {
  path: string;
  expected: unknown;
  actual: unknown;
}

/**
 * Finds the first key path where `actual` fails to satisfy `expected`'s partial shape, or `null`
 * if every key `expected` names is present and equal (recursively) on `actual`. Extra keys on
 * `actual` — including array elements beyond `expected`'s length — are always ignored: this is a
 * subset/partial match, not equality (task 07 origin; task 08 reuses it for `expectState`).
 */
export function findPartialMismatch(
  actual: unknown,
  expected: unknown,
  path = '',
): PartialMismatch | null {
  if (typeof expected !== 'object' || expected === null) {
    return Object.is(actual, expected) ? null : { path: path || '(root)', expected, actual };
  }
  if (typeof actual !== 'object' || actual === null) {
    return { path: path || '(root)', expected, actual };
  }
  for (const [key, value] of Object.entries(expected)) {
    const childPath = path ? `${path}.${key}` : key;
    const mismatch = findPartialMismatch(
      (actual as Record<string, unknown>)[key],
      value,
      childPath,
    );
    if (mismatch) return mismatch;
  }
  return null;
}

/** True iff every key `expected` names matches `actual`, recursively (see `findPartialMismatch`). */
export function partialMatches(actual: unknown, expected: unknown): boolean {
  return findPartialMismatch(actual, expected) === null;
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

export function describeEventSequenceFailure(
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
