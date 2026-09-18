// Debug mutations. These are not player commands and never go through `applyCommand` — they
// install a new `RunState` the same way Continue / the test handle do. Pure: seed is passed in
// (CLAUDE.md rule 1). Presentation never calls these during a kid-facing flow.

import type { Col, Lane } from '../../../sim/core/coords';
import { isLane } from '../../../sim/core/coords';
import type { RunState, TileId } from '../../../sim/core/types';
import { allocatePieceId, allocateRobotId } from '../../../sim/commands/ids';
import { buildLevelState } from '../../../sim/commands/level';
import { buildNewRun } from '../../../sim/commands/newRun';
import { buildNextWave } from '../../../sim/commands/nextWave';
import type { GameData } from '../../../sim/data/schemas';
import { SPAWN_COL } from '../../../sim/waves/spawn';

export type DebugResult = { ok: true; run: RunState } | { ok: false; error: string };

function ok(run: RunState): DebugResult {
  return { ok: true, run };
}

function fail(error: string): DebugResult {
  return { ok: false, error };
}

function stripLiveBoard(state: RunState): RunState {
  return {
    ...state,
    board: { ...state.board, robots: [] },
    pendingSpawns: [],
    undo: [],
    lastTurnEvents: [],
    shop: null,
    phase: 'planning',
  };
}

/** A run to mutate, or a fresh one when the menu is opened from the title screen. */
export function ensureRun(run: RunState | null, data: GameData, seed: string): RunState {
  return run ?? buildNewRun(seed, data).state;
}

export function debugJumpToLevel(data: GameData, levelId: string): DebugResult {
  const levelDef = data.levels.levels.find((level) => level.id === levelId);
  if (!levelDef) return fail(`unknown level "${levelId}"`);
  return ok(buildLevelState(levelDef, data));
}

/**
 * Land on wave `waveIndex` (0-based) in planning.
 * Forward from an existing run keeps tiles / coins / cannons / HP.
 * Backward, or jumping from a puzzle / the menu, starts a fresh run and walks up.
 */
export function debugJumpToWave(
  run: RunState | null,
  data: GameData,
  waveIndex: number,
  seed: string,
): DebugResult {
  const waves = data.waves.waves;
  if (!Number.isInteger(waveIndex) || waveIndex < 0 || waveIndex >= waves.length) {
    return fail(`unknown wave ${waveIndex + 1}`);
  }

  const seedToUse = run?.mode === 'run' ? run.seed : seed;
  let current: RunState;
  if (run?.mode === 'run' && run.waveIndex <= waveIndex) {
    current = run;
  } else {
    current = buildNewRun(seedToUse, data).state;
  }

  while (current.waveIndex < waveIndex) {
    current = buildNextWave(stripLiveBoard(current), data).state;
  }
  return ok(current);
}

export function debugAddTile(
  run: RunState | null,
  data: GameData,
  tileId: TileId,
  seed: string,
): DebugResult {
  if (!data.tiles.some((tile) => tile.id === tileId)) {
    return fail(`unknown tile "${tileId}"`);
  }
  const current = ensureRun(run, data, seed);
  const [pieceId, nextIds] = allocatePieceId(current.nextIds);
  return ok({
    ...current,
    nextIds,
    pieces: { ...current.pieces, [pieceId]: { pieceId, tileId } },
    tray: [...current.tray, pieceId],
    undo: [],
  });
}

export const DEBUG_HP_PRESETS = [1, 5, 10, 20, 50, 100, 150] as const;

export function defaultDebugHp(isBoss: boolean): number {
  return isBoss ? 100 : 10;
}

function firstOpenCol(run: RunState, lane: Lane): Col | null {
  for (let col = SPAWN_COL; col >= 1; col--) {
    if (!run.board.robots.some((robot) => robot.lane === lane && robot.col === col)) {
      return col as Col;
    }
  }
  return null;
}

export function debugAddRobot(
  run: RunState | null,
  data: GameData,
  options: { templateId: string; lane: number; hp: number },
  seed: string,
): DebugResult {
  const template = data.robots.find((candidate) => candidate.id === options.templateId);
  if (!template) return fail(`unknown robot "${options.templateId}"`);
  if (!isLane(options.lane)) return fail(`bad lane ${options.lane}`);
  if (!Number.isInteger(options.hp) || options.hp < 1 || options.hp > 150) {
    return fail(`bad hp ${options.hp}`);
  }

  const current = ensureRun(run, data, seed);
  const [robotId, nextIds] = allocateRobotId(current.nextIds);
  const col = firstOpenCol(current, options.lane);
  return ok({
    ...current,
    nextIds,
    board: {
      ...current.board,
      robots: [
        ...current.board.robots,
        {
          robotId,
          lane: options.lane,
          col,
          hp: options.hp,
          maxHp: options.hp,
          trait: template.trait,
          isBoss: template.isBoss,
        },
      ],
    },
    undo: [],
  });
}

export function makeDebugSeed(now = Date.now, random = Math.random): string {
  return `debug:${now()}:${random().toString(36).slice(2)}`;
}
