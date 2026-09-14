// `applyCommand(state, cmd, data)` (TR §5): the single entry point for every player command.
// Dispatches to the small per-command functions in `./planning.ts` and `./level.ts`; validation
// and mutation live there, not here.
//
// `endTurn` requires phase `planning` (else `wrong_phase`) and otherwise delegates to task 07's
// `resolveTurn`, returning its state and events directly. `buyOffer`/`leaveShop`/`newRun` are
// M3/M1-run features not yet implemented, so they still return `wrong_phase` (task 06 ruling).

import type { Command, CommandError, GameEvent, RunState } from '../core/types';
import type { GameData } from '../data/schemas';
import { resolveTurn } from '../resolve/resolveTurn';
import { buildLevelState } from './level';
import { moveCannon, moveTile, placeTile, returnTile, undoCommand } from './planning';
import type { CommandResult } from './types';

export type ApplyCommandResult =
  { ok: true; state: RunState; events: GameEvent[] } | { ok: false; error: CommandError };

/** Planning commands never emit events (task 06 requirement 7) — only `resolveTurn` (task 07)
 * produces a real event list. */
function withNoEvents(result: CommandResult): ApplyCommandResult {
  if (!result.ok) return result;
  return { ok: true, state: result.state, events: [] };
}

export function applyCommand(
  state: RunState | null,
  cmd: Command,
  data: GameData,
): ApplyCommandResult {
  // `loadLevel` is the one command that installs a run from scratch — it accepts `state: null`
  // or any phase (it resets), unlike every other command (task 06 ruling).
  if (cmd.type === 'loadLevel') {
    const levelDef = data.levels.levels.find((level) => level.id === cmd.levelId);
    if (!levelDef) {
      throw new Error(`loadLevel: unknown levelId "${cmd.levelId}"`);
    }
    return { ok: true, state: buildLevelState(levelDef, data), events: [] };
  }

  if (state === null) {
    return { ok: false, error: 'wrong_phase' };
  }

  switch (cmd.type) {
    case 'placeTile':
      return withNoEvents(placeTile(state, cmd));
    case 'moveTile':
      return withNoEvents(moveTile(state, cmd));
    case 'returnTile':
      return withNoEvents(returnTile(state, cmd));
    case 'moveCannon':
      return withNoEvents(moveCannon(state, cmd));
    case 'undo':
      return withNoEvents(undoCommand(state));
    case 'endTurn': {
      if (state.phase !== 'planning') return { ok: false, error: 'wrong_phase' };
      const result = resolveTurn(state, data);
      return { ok: true, state: result.state, events: result.events };
    }
    case 'buyOffer':
    case 'leaveShop':
    case 'newRun':
      return { ok: false, error: 'wrong_phase' };
  }
}
