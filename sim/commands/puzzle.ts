// Builds and advances puzzle-book sessions (GDD §10.8, TR §4.2). Pure: `buildPuzzleState` and
// `buildPuzzleNextWave` read `data.puzzles` and return a new `RunState`. Puzzle waves use
// fixed HP and fixed lanes (no `rollWave`); tiles and extra cannons are granted on each wave.

import { cols, lanes, type Lane } from '../core/coords';
import { createStreams } from '../core/rng';
import type { GameEvent, Robot, RunState, SpawnEntry, TileId, TilePiece } from '../core/types';
import type { GameData, PuzzleDef, PuzzleWaveDef } from '../data/schemas';
import { spawn } from '../waves/spawn';
import { allocatePieceId, allocateRobotId } from './ids';

export function findPuzzle(data: GameData, puzzleId: string | undefined): PuzzleDef | undefined {
  if (puzzleId === undefined) return undefined;
  return data.puzzles.puzzles.find((puzzle) => puzzle.id === puzzleId);
}

export function playablePuzzle(data: GameData, puzzleId: string): PuzzleDef & { waves: PuzzleWaveDef[] } {
  const puzzle = findPuzzle(data, puzzleId);
  if (!puzzle || puzzle.waves === undefined) {
    throw new Error(`loadPuzzle: unknown or locked puzzleId "${puzzleId}"`);
  }
  return puzzle as PuzzleDef & { waves: PuzzleWaveDef[] };
}

export function puzzleWaveCount(data: GameData, puzzleId: string | undefined): number {
  return findPuzzle(data, puzzleId)?.waves?.length ?? 0;
}

/** Wave count for HUD / last-wave checks: the puzzle's waves, or the ladder. */
export function sessionWaveCount(state: Pick<RunState, 'mode' | 'puzzleId'>, data: GameData): number {
  if (state.mode === 'puzzle') return puzzleWaveCount(data, state.puzzleId);
  return data.waves.waves.length;
}

function puzzleSpawns(wave: PuzzleWaveDef): SpawnEntry[] {
  return wave.spawns
    .map((spawn) => ({
      turn: spawn.turn,
      lane: spawn.lane,
      robotTemplateId: spawn.robot,
      hp: spawn.hp,
    }))
    .sort((a, b) => a.turn - b.turn);
}

function grantTiles(
  state: RunState,
  tileIds: readonly TileId[],
  firstStep: number,
): { state: RunState; events: GameEvent[] } {
  if (tileIds.length === 0) return { state, events: [] };

  let nextIds = state.nextIds;
  const pieces: Record<string, TilePiece> = { ...state.pieces };
  const tray = [...state.tray];
  const granted: { pieceId: string; tileId: TileId }[] = [];
  for (const tileId of tileIds) {
    const [pieceId, next] = allocatePieceId(nextIds);
    nextIds = next;
    pieces[pieceId] = { pieceId, tileId };
    tray.push(pieceId);
    granted.push({ pieceId, tileId });
  }
  return {
    state: { ...state, nextIds, pieces, tray },
    events: [{ step: firstStep, group: 'end', type: 'TilesGranted', tiles: granted }],
  };
}

function addCannons(
  state: RunState,
  extra: readonly Lane[],
  firstStep: number,
): { state: RunState; events: GameEvent[] } {
  if (extra.length === 0) return { state, events: [] };
  const cannons = [...state.board.cannons];
  const events: GameEvent[] = [];
  for (const lane of extra) {
    if (cannons[lane]) continue;
    cannons[lane] = true;
    events.push({ step: firstStep + events.length, group: 'end', type: 'CannonPlaced', lane });
  }
  return { state: { ...state, board: { ...state.board, cannons } }, events };
}

function placeBoardTiles(state: RunState, wave: PuzzleWaveDef): RunState {
  if (wave.boardTiles.length === 0) return state;
  let nextIds = state.nextIds;
  const pieces: Record<string, TilePiece> = { ...state.pieces };
  const cells = state.board.cells.map((row) => [...row]);
  for (const placement of wave.boardTiles) {
    if (cells[placement.lane]![placement.col] !== null) {
      throw new Error(
        `puzzle: cell lane ${placement.lane} col ${placement.col} is occupied, cannot place ${placement.tileId}`,
      );
    }
    const [pieceId, next] = allocatePieceId(nextIds);
    nextIds = next;
    pieces[pieceId] = { pieceId, tileId: placement.tileId };
    cells[placement.lane]![placement.col] = pieceId;
  }
  return { ...state, nextIds, pieces, board: { ...state.board, cells } };
}

function placeStartingRobots(state: RunState, wave: PuzzleWaveDef, data: GameData): RunState {
  if (wave.robots.length === 0) return state;
  let nextIds = state.nextIds;
  const robots: Robot[] = [...state.board.robots];
  for (const def of wave.robots) {
    const template = data.robots.find((robot) => robot.id === def.robot);
    if (!template) {
      throw new Error(`puzzle: unknown robot template "${def.robot}"`);
    }
    const [robotId, next] = allocateRobotId(nextIds);
    nextIds = next;
    robots.push({
      robotId,
      lane: def.lane,
      col: def.col,
      hp: def.hp,
      maxHp: def.hp,
      trait: template.trait,
      isBoss: false,
    });
  }
  return { ...state, nextIds, board: { ...state.board, robots } };
}

function applyWaveKit(
  state: RunState,
  wave: PuzzleWaveDef,
  data: GameData,
  startingCannons: boolean,
): { state: RunState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let next = state;

  if (startingCannons) {
    next = {
      ...next,
      board: {
        ...next.board,
        cannons: lanes().map((lane) => wave.cannons.includes(lane)),
      },
    };
  } else {
    const extra = addCannons(next, wave.cannons, events.length);
    next = extra.state;
    events.push(...extra.events);
  }

  if (wave.baseValue !== undefined) {
    next = { ...next, cannonBaseValue: wave.baseValue };
  }

  next = placeBoardTiles(next, wave);
  next = placeStartingRobots(next, wave, data);

  const granted = grantTiles(next, wave.grantTiles, events.length);
  next = granted.state;
  events.push(...granted.events);

  next = {
    ...next,
    turn: 1,
    phase: 'planning',
    pendingSpawns: puzzleSpawns(wave),
    undo: [],
    lastTurnEvents: [],
    shop: null,
  };

  const spawned = spawn(next, data, events.length);
  events.push(...spawned.events);
  return { state: spawned.state, events };
}

export function buildPuzzleState(
  puzzle: PuzzleDef & { waves: PuzzleWaveDef[] },
  data: GameData,
): { state: RunState; events: GameEvent[] } {
  const seed = `puzzle:${puzzle.id}`;
  const streams = createStreams(seed);
  const first = puzzle.waves[0]!;

  const blank: RunState = {
    schemaVersion: data.economy.schemaVersion,
    mode: 'puzzle',
    difficulty: 'normal',
    puzzleId: puzzle.id,
    seed,
    rng: { wave: streams.wave, shop: streams.shop },
    phase: 'planning',
    waveIndex: 0,
    turn: 1,
    baseHp: data.economy.baseHp,
    coins: data.economy.startCoins,
    cannonBaseValue: data.economy.startBaseValue,
    upgradesBought: 0,
    exactKills: 0,
    pieces: {},
    tray: [],
    board: {
      cannons: lanes().map(() => false),
      cells: lanes().map(() => cols().map(() => null)),
      robots: [],
    },
    pendingSpawns: [],
    undo: [],
    lastTurnEvents: [],
    shop: null,
    nextIds: { robot: 0, piece: 0, ball: 0 },
  };

  return applyWaveKit(blank, first, data, true);
}

export function buildPuzzleNextWave(
  state: RunState,
  data: GameData,
): { state: RunState; events: GameEvent[] } {
  const puzzle = playablePuzzle(data, state.puzzleId ?? '');
  const waveIndex = state.waveIndex + 1;
  const wave = puzzle.waves[waveIndex];
  if (!wave) {
    throw new Error(`nextWave: puzzle "${puzzle.id}" has no wave ${waveIndex + 1}`);
  }
  return applyWaveKit({ ...state, waveIndex }, wave, data, false);
}
