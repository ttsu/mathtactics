// Shared result type for the small per-command functions in `/sim/commands` (TR §5).
// `applyCommand` wraps a successful `CommandResult` with `events: []` — planning commands never
// emit events (task 06 requirement 7); only `resolveTurn` (task 07) produces a real event list.

import type { CommandError, RunState } from '../core/types';

export type CommandResult = { ok: true; state: RunState } | { ok: false; error: CommandError };

export function ok(state: RunState): CommandResult {
  return { ok: true, state };
}

export function fail(error: CommandError): CommandResult {
  return { ok: false, error };
}
