// Builds a `RunState` from a hand-authored level definition (TR §4.1, task 06 ruling). Pure:
// `buildLevelState` reads `levelDef`/`data` and returns a brand-new state; `loadLevel` (the
// `applyCommand` case) just looks the level up by id and calls it.
//
// Task 08's scenario runner reuses `buildLevelState` for scenario files, which is why the
// inputs are a plain `LevelDef` + `GameData` rather than anything `applyCommand`-specific.

import { cols, lanes } from '../core/coords';
import { createStreams } from '../core/rng';
import type { Robot, RunState, TilePiece } from '../core/types';
import type { GameData, LevelDef } from '../data/schemas';
import { allocatePieceId, allocateRobotId } from './ids';

export function buildLevelState(levelDef: LevelDef, data: GameData): RunState {
  const seed = `level:${levelDef.id}`;

  let nextIds: RunState['nextIds'] = { robot: 0, piece: 0, ball: 0 };
  const pieces: Record<string, TilePiece> = {};

  const cells: (string | null)[][] = lanes().map(() => cols().map(() => null));
  for (const placement of levelDef.boardTiles) {
    const [pieceId, next] = allocatePieceId(nextIds);
    nextIds = next;
    pieces[pieceId] = { pieceId, tileId: placement.tileId };
    cells[placement.lane]![placement.col] = pieceId;
  }

  const tray: string[] = [];
  for (const tileId of levelDef.tray) {
    const [pieceId, next] = allocatePieceId(nextIds);
    nextIds = next;
    pieces[pieceId] = { pieceId, tileId };
    tray.push(pieceId);
  }

  const cannons = lanes().map((lane) => levelDef.cannonLanes.includes(lane));

  const robots: Robot[] = [];
  for (const robotDef of levelDef.robots) {
    const [robotId, next] = allocateRobotId(nextIds);
    nextIds = next;
    robots.push({
      robotId,
      lane: robotDef.lane,
      col: robotDef.col,
      hp: robotDef.hp,
      maxHp: robotDef.hp,
      trait: robotDef.trait,
      isBoss: false,
    });
  }

  return {
    schemaVersion: data.economy.schemaVersion,
    mode: 'level',
    levelId: levelDef.id,
    seed,
    rng: createStreams(seed),
    phase: 'planning',
    waveIndex: 0,
    turn: 1,
    baseHp: data.economy.baseHp,
    coins: data.economy.startCoins,
    cannonBaseValue: levelDef.baseValue,
    upgradesBought: 0,
    pieces,
    tray,
    board: { cannons, cells, robots },
    pendingSpawns: [],
    undo: [],
    lastTurnEvents: [],
    shop: null,
    nextIds,
  };
}
