// Planning-phase commands (GDD §3.3–3.4, §4.2–4.3, §9.3–9.4; TR §5): placing, moving, and
// returning tiles; moving cannons; multi-level undo. Pure — every function returns a new
// `RunState` and never mutates its input (task 06 requirement 5).
//
// Validation precedence, when several errors could apply to the same command (task 06 ruling):
// `wrong_phase` -> `not_a_tile_cell` -> `cell_locked` -> `no_tile_here` / `piece_not_in_tray` /
// `no_cannon_here` -> `cell_occupied` / `slot_occupied`. Each function below checks in exactly
// that order.

import { isTileCell } from '../core/coords';
import type { Command, PlanningSnapshot, RunState } from '../core/types';
import { robotAt, tileAt } from './boardQueries';
import { fail, ok, type CommandResult } from './types';

/** Captures the parts of `state` a planning command may change (TR §5), for `undo` to restore
 * later. Deep-copies so a later in-place mutation of `state.board` (there is none today, but
 * nothing here should ever rely on that) can't corrupt a pushed snapshot. */
function snapshotOf(state: RunState): PlanningSnapshot {
  return {
    cells: state.board.cells.map((row) => [...row]),
    tray: [...state.tray],
    cannons: [...state.board.cannons],
  };
}

function pushSnapshot(state: RunState): PlanningSnapshot[] {
  return [...state.undo, snapshotOf(state)];
}

export function placeTile(
  state: RunState,
  cmd: Extract<Command, { type: 'placeTile' }>,
): CommandResult {
  if (state.phase !== 'planning') return fail('wrong_phase');
  if (!isTileCell(cmd.to.col)) return fail('not_a_tile_cell');
  if (robotAt(state.board, cmd.to)) return fail('cell_locked');
  if (!state.tray.includes(cmd.pieceId)) return fail('piece_not_in_tray');
  if (tileAt(state.board, cmd.to) !== null) return fail('cell_occupied');

  const cells = state.board.cells.map((row) => [...row]);
  cells[cmd.to.lane]![cmd.to.col] = cmd.pieceId;

  return ok({
    ...state,
    board: { ...state.board, cells },
    tray: state.tray.filter((pieceId) => pieceId !== cmd.pieceId),
    undo: pushSnapshot(state),
  });
}

export function moveTile(
  state: RunState,
  cmd: Extract<Command, { type: 'moveTile' }>,
): CommandResult {
  if (state.phase !== 'planning') return fail('wrong_phase');
  if (!isTileCell(cmd.to.col)) return fail('not_a_tile_cell');
  if (robotAt(state.board, cmd.from) || robotAt(state.board, cmd.to)) return fail('cell_locked');
  const pieceId = tileAt(state.board, cmd.from);
  if (pieceId === null) return fail('no_tile_here');
  if (tileAt(state.board, cmd.to) !== null) return fail('cell_occupied');

  const cells = state.board.cells.map((row) => [...row]);
  cells[cmd.from.lane]![cmd.from.col] = null;
  cells[cmd.to.lane]![cmd.to.col] = pieceId;

  return ok({
    ...state,
    board: { ...state.board, cells },
    undo: pushSnapshot(state),
  });
}

export function returnTile(
  state: RunState,
  cmd: Extract<Command, { type: 'returnTile' }>,
): CommandResult {
  if (state.phase !== 'planning') return fail('wrong_phase');
  if (robotAt(state.board, cmd.from)) return fail('cell_locked');
  const pieceId = tileAt(state.board, cmd.from);
  if (pieceId === null) return fail('no_tile_here');

  const cells = state.board.cells.map((row) => [...row]);
  cells[cmd.from.lane]![cmd.from.col] = null;

  return ok({
    ...state,
    board: { ...state.board, cells },
    tray: [...state.tray, pieceId],
    undo: pushSnapshot(state),
  });
}

export function moveCannon(
  state: RunState,
  cmd: Extract<Command, { type: 'moveCannon' }>,
): CommandResult {
  if (state.phase !== 'planning') return fail('wrong_phase');
  if (!state.board.cannons[cmd.fromLane]) return fail('no_cannon_here');
  if (state.board.cannons[cmd.toLane]) return fail('slot_occupied');

  const cannons = [...state.board.cannons];
  cannons[cmd.fromLane] = false;
  cannons[cmd.toLane] = true;

  return ok({
    ...state,
    board: { ...state.board, cannons },
    undo: pushSnapshot(state),
  });
}

/** Pops the most recent `PlanningSnapshot` and restores board cells/tray/cannons from it.
 * Never touches coins, robots, or phase (GDD §4.3) — everything else in `state` is left as-is. */
export function undoCommand(state: RunState): CommandResult {
  if (state.phase !== 'planning') return fail('wrong_phase');
  const snapshot = state.undo[state.undo.length - 1];
  if (!snapshot) return fail('nothing_to_undo');

  return ok({
    ...state,
    board: {
      ...state.board,
      cells: snapshot.cells.map((row) => [...row]),
      cannons: [...snapshot.cannons],
    },
    tray: [...snapshot.tray],
    undo: state.undo.slice(0, -1),
  });
}
