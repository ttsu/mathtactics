// `applyCommand(state, cmd, data)` (TR §5): the single entry point for every player command.
// Dispatches to the small per-command functions in `./planning.ts`, `./openShop.ts`,
// `./buyOffer.ts`, and `./level.ts`; validation and mutation live there, not here.
//
// `endTurn` requires phase `planning` (else `wrong_phase`) and otherwise delegates to
// `resolveTurn`, returning its state and events directly. `newRun` and `loadLevel` both
// accept a null state or any phase. `nextWave` requires phase `shop` (M3; it was `waveCleared`
// in M2, before the shop sat between them).

import type { Command, CommandError, GameEvent, RunState } from '../core/types';
import type { GameData } from '../data/schemas';
import { resolveTurn } from '../resolve/resolveTurn';
import { buyOffer } from './buyOffer';
import { buildLevelState } from './level';
import { buildNewRun } from './newRun';
import { buildNextWave } from './nextWave';
import { buildPuzzleNextWave, buildPuzzleState, playablePuzzle } from './puzzle';
import { openShop } from './openShop';
import { moveCannon, moveTile, placeTile, returnTile, undoCommand } from './planning';
import type { CommandResult } from './types';

export type ApplyCommandResult =
  { ok: true; state: RunState; events: GameEvent[] } | { ok: false; error: CommandError };

/** Planning commands never emit events (task 06 requirement 7) — only `resolveTurn` (task 07)
 * and `buyOffer` (task 19) produce a real event list. */
function withNoEvents(result: CommandResult): ApplyCommandResult {
  if (!result.ok) return result;
  return { ok: true, state: result.state, events: [] };
}

export function applyCommand(
  state: RunState | null,
  cmd: Command,
  data: GameData,
): ApplyCommandResult {
  // `loadLevel`, `loadPuzzle`, and `newRun` install a state from scratch — they accept
  // `state: null` or any phase (they replace it), unlike every other command (task 06 ruling, TR §5).
  if (cmd.type === 'newRun') {
    const result = buildNewRun(cmd.seed, data, cmd.difficulty);
    return { ok: true, state: result.state, events: result.events };
  }

  if (cmd.type === 'loadLevel') {
    const levelDef = data.levels.levels.find((level) => level.id === cmd.levelId);
    if (!levelDef) {
      throw new Error(`loadLevel: unknown levelId "${cmd.levelId}"`);
    }
    return { ok: true, state: buildLevelState(levelDef, data), events: [] };
  }

  if (cmd.type === 'loadPuzzle') {
    const puzzle = playablePuzzle(data, cmd.puzzleId);
    const result = buildPuzzleState(puzzle, data);
    return { ok: true, state: result.state, events: result.events };
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
    case 'openShop':
      return withNoEvents(openShop(state, data));
    case 'buyOffer':
      return buyOffer(state, cmd);
    case 'nextWave': {
      if (state.mode === 'puzzle') {
        if (state.phase !== 'waveCleared') return { ok: false, error: 'wrong_phase' };
        const result = buildPuzzleNextWave(state, data);
        return { ok: true, state: result.state, events: result.events };
      }
      if (state.phase !== 'shop') return { ok: false, error: 'wrong_phase' };
      const result = buildNextWave(state, data);
      return { ok: true, state: result.state, events: result.events };
    }
  }
}
