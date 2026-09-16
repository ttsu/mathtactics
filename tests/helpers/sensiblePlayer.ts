// Shared "sensible player" and End-Turn-only drivers for ladder balance tests and the
// full-run e2e (task 21). Every mutation goes through `applyCommand` — this file only
// chooses commands. Ball values reuse `applyTile` (GDD §5.3 / §9.2).

import { applyCommand } from '../../sim/commands/applyCommand';
import { robotAt, tileAt } from '../../sim/commands/boardQueries';
import type { Col, Lane } from '../../sim/core/coords';
import { COLS, lanes } from '../../sim/core/coords';
import { applyTile } from '../../sim/core/tiles';
import type {
  Command,
  RunState,
  ShopOffer,
  ShopSlotId,
  TileDef,
  TileId,
} from '../../sim/core/types';
import type { GameData } from '../../sim/data/schemas';

const MAX_ARRANGEMENTS = 3000;
const MAX_TILES_PER_LANE = 3;

export function requireOk<T extends { ok: boolean }>(result: T): T & { ok: true } {
  if (!result.ok) {
    throw new Error(`command failed: ${JSON.stringify(result)}`);
  }
  return result as T & { ok: true };
}

export function applyOk(state: RunState | null, cmd: Command, data: GameData): RunState {
  return requireOk(applyCommand(state, cmd, data)).state;
}

function tileDef(data: GameData, tileId: TileId): TileDef {
  const def = data.tiles.find((tile) => tile.id === tileId);
  if (!def) throw new Error(`unknown tile id "${tileId}"`);
  return def;
}

export function cannonCount(state: RunState): number {
  return state.board.cannons.filter(Boolean).length;
}

export function ownedTileIds(state: RunState): TileId[] {
  return Object.values(state.pieces).map((piece) => piece.tileId);
}

function ownsMul(state: RunState): boolean {
  return ownedTileIds(state).some((id) => id.startsWith('mul:'));
}

function frontRobotInLane(state: RunState, lane: Lane) {
  const onBoard = state.board.robots.filter((robot) => robot.lane === lane && robot.col !== null);
  if (onBoard.length === 0) return null;
  onBoard.sort((a, b) => a.col! - b.col!);
  return onBoard[0]!;
}

export function frontmostRobotLane(state: RunState): Lane | null {
  const onBoard = state.board.robots.filter((robot) => robot.col !== null);
  if (onBoard.length === 0) return null;
  onBoard.sort((a, b) => a.col! - b.col! || a.lane - b.lane);
  return onBoard[0]!.lane;
}

function emptyColsInFront(state: RunState, lane: Lane, robotCol: Col): Col[] {
  const cols: Col[] = [];
  for (let col = 1; col < robotCol; col++) {
    const cell = { lane, col: col as Col };
    if (robotAt(state.board, cell)) continue;
    if (tileAt(state.board, cell) !== null) continue;
    cols.push(col as Col);
  }
  return cols;
}

function ballValue(base: number, defs: TileDef[]): number {
  let value = base;
  for (const def of defs) value = applyTile(value, def);
  return value;
}

/** All sequences of up to `kMax` distinct piece ids, bounded so the suite stays fast. */
function pieceSequences(pieceIds: string[], kMax: number): string[][] {
  const result: string[][] = [[]];
  const used = pieceIds.map(() => false);
  const acc: string[] = [];

  const rec = () => {
    if (result.length >= MAX_ARRANGEMENTS) return;
    if (acc.length === kMax) return;
    for (let i = 0; i < pieceIds.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      acc.push(pieceIds[i]!);
      result.push([...acc]);
      rec();
      acc.pop();
      used[i] = false;
      if (result.length >= MAX_ARRANGEMENTS) return;
    }
  };

  rec();
  return result;
}

function arrangementRank(value: number, hp: number): [number, number] {
  if (value === hp) return [2, value];
  if (value <= hp) return [1, value];
  return [0, value];
}

function betterRank(a: [number, number], b: [number, number]): boolean {
  if (a[0] !== b[0]) return a[0] > b[0];
  return a[1] > b[1];
}

function bestSequence(
  state: RunState,
  data: GameData,
  pieceIds: string[],
  hp: number,
  kMax: number,
): string[] {
  const sequences = pieceSequences(pieceIds, kMax);
  let best: string[] = [];
  let bestRank: [number, number] = arrangementRank(state.cannonBaseValue, hp);
  for (const seq of sequences) {
    const defs = seq.map((pieceId) => {
      const piece = state.pieces[pieceId];
      if (!piece) throw new Error(`missing piece ${pieceId}`);
      return tileDef(data, piece.tileId);
    });
    const value = ballValue(state.cannonBaseValue, defs);
    const rank = arrangementRank(value, hp);
    if (betterRank(rank, bestRank)) {
      bestRank = rank;
      best = seq;
    }
  }
  return best;
}

/** Reachable ball values with 0–3 owned tiles (order matters; tiles are not consumed). */
export function reachableBallValues(state: RunState, data: GameData): number[] {
  const pieceIds = Object.keys(state.pieces).sort();
  const values = new Set<number>();
  for (const seq of pieceSequences(pieceIds, MAX_TILES_PER_LANE)) {
    const defs = seq.map((pieceId) => tileDef(data, state.pieces[pieceId]!.tileId));
    values.add(ballValue(state.cannonBaseValue, defs));
  }
  return [...values];
}

export function canExactKillInAtMostTwoHits(hp: number, values: number[]): boolean {
  const set = new Set(values);
  if (set.has(hp)) return true;
  for (const first of values) {
    const chip = Math.max(0, first);
    if (chip <= 0 || chip >= hp) continue;
    const remaining = hp - chip;
    if (set.has(remaining)) return true;
  }
  return false;
}

function returnBoardTiles(state: RunState, data: GameData): { state: RunState; commands: Command[] } {
  const commands: Command[] = [];
  let next = state;
  for (const lane of lanes()) {
    for (let col = 1; col < COLS; col++) {
      const from = { lane, col: col as Col };
      if (robotAt(next.board, from)) continue;
      if (tileAt(next.board, from) === null) continue;
      const cmd: Command = { type: 'returnTile', from };
      next = applyOk(next, cmd, data);
      commands.push(cmd);
    }
  }
  return { state: next, commands };
}

function maybeMoveCannon(state: RunState, data: GameData): { state: RunState; commands: Command[] } {
  const reachable = lanes().some(
    (lane) => state.board.cannons[lane] && frontRobotInLane(state, lane) !== null,
  );
  if (reachable) return { state, commands: [] };

  const target = frontmostRobotLane(state);
  if (target === null || state.board.cannons[target]) return { state, commands: [] };

  const fromLane = lanes().find((lane) => state.board.cannons[lane]);
  if (fromLane === undefined) return { state, commands: [] };

  const cmd: Command = { type: 'moveCannon', fromLane, toLane: target };
  return { state: applyOk(state, cmd, data), commands: [cmd] };
}

function placeForArmedLanes(
  state: RunState,
  data: GameData,
): { state: RunState; commands: Command[] } {
  const commands: Command[] = [];
  let next = state;

  const jobs = lanes()
    .filter((lane) => next.board.cannons[lane])
    .map((lane) => {
      const robot = frontRobotInLane(next, lane);
      return robot ? { lane, robot } : null;
    })
    .filter((job): job is { lane: Lane; robot: NonNullable<ReturnType<typeof frontRobotInLane>> } =>
      job !== null,
    );
  jobs.sort((a, b) => a.robot.col! - b.robot.col! || a.lane - b.lane);

  for (const job of jobs) {
    const cols = emptyColsInFront(next, job.lane, job.robot.col!);
    if (cols.length === 0) continue;
    const available = [...next.tray].sort();
    const kMax = Math.min(MAX_TILES_PER_LANE, cols.length, available.length);
    const seq = bestSequence(next, data, available, job.robot.hp, kMax);
    for (let i = 0; i < seq.length; i++) {
      const cmd: Command = {
        type: 'placeTile',
        pieceId: seq[i]!,
        to: { lane: job.lane, col: cols[i]! },
      };
      next = applyOk(next, cmd, data);
      commands.push(cmd);
    }
  }

  return { state: next, commands };
}

/** Planning-phase commands (return tiles, maybe move a cannon, place up to 3 tiles per armed
 * lane). Does not include `endTurn`. */
export function planningCommands(state: RunState, data: GameData): Command[] {
  if (state.phase !== 'planning') return [];
  const returned = returnBoardTiles(state, data);
  const moved = maybeMoveCannon(returned.state, data);
  const placed = placeForArmedLanes(moved.state, data);
  return [...returned.commands, ...moved.commands, ...placed.commands];
}

export function applyPlanningPolicy(
  state: RunState,
  data: GameData,
): { state: RunState; commands: Command[] } {
  const commands = planningCommands(state, data);
  let next = state;
  for (const cmd of commands) next = applyOk(next, cmd, data);
  return { state: next, commands };
}

export type ShopChoice =
  | { kind: 'buy'; slot: ShopSlotId }
  | { kind: 'done' };

function unboughtAffordable(state: RunState): ShopOffer[] {
  if (state.shop === null) return [];
  return state.shop.offers.filter((offer) => {
    if (offer.bought) return false;
    if (offer.kind === 'cannon' && !offer.available) return false;
    return offer.price <= state.coins;
  });
}

export function nextShopChoice(state: RunState): ShopChoice {
  if (state.phase !== 'shop' || state.shop === null) return { kind: 'done' };
  const affordable = unboughtAffordable(state);

  const cannon = affordable.find((offer) => offer.kind === 'cannon');
  if (cannon && cannonCount(state) < 3) {
    return { kind: 'buy', slot: cannon.slot };
  }

  const tiles = affordable.filter((offer) => offer.kind === 'tile');
  if (tiles.length > 0) {
    const pool =
      !ownsMul(state) && tiles.some((offer) => offer.kind === 'tile' && offer.tileId.startsWith('mul:'))
        ? tiles.filter((offer) => offer.kind === 'tile' && offer.tileId.startsWith('mul:'))
        : tiles;
    pool.sort((a, b) => a.price - b.price || a.slot.localeCompare(b.slot));
    return { kind: 'buy', slot: pool[0]!.slot };
  }

  const upgrade = affordable.find((offer) => offer.kind === 'upgrade');
  if (upgrade) return { kind: 'buy', slot: upgrade.slot };

  return { kind: 'done' };
}

export function shopHasAffordable(state: RunState): boolean {
  return unboughtAffordable(state).length > 0;
}

export function applyShopPolicy(state: RunState, data: GameData): {
  state: RunState;
  purchases: string[];
  spent: number;
} {
  let next = state;
  const purchases: string[] = [];
  let spent = 0;
  while (true) {
    const choice = nextShopChoice(next);
    if (choice.kind === 'done') break;
    const offer = next.shop!.offers.find((item) => item.slot === choice.slot)!;
    spent += offer.price;
    if (offer.kind === 'tile') purchases.push(offer.tileId);
    else purchases.push(offer.kind);
    next = applyOk(next, { type: 'buyOffer', slot: choice.slot }, data);
  }
  return { state: next, purchases, spent };
}

export interface ShopVisitStats {
  afterWave: number;
  coinsOnEnter: number;
  earned: number;
  spent: number;
  leftover: number;
  purchases: string[];
  hadAffordable: boolean;
  cannonAffordable: boolean;
}

export interface WaveEntrySnapshot {
  waveIndex: number;
  hps: number[];
  values: number[];
}

export interface SensibleRunStats {
  seed: string;
  phase: RunState['phase'];
  baseHp: number;
  minBaseHp: number;
  endTurns: number;
  turnsPerWave: number[];
  shops: ShopVisitStats[];
  waveEntries: WaveEntrySnapshot[];
}

const MAX_END_TURNS = 400;

export function playSensibleRun(seed: string, data: GameData): SensibleRunStats {
  let state = applyOk(null, { type: 'newRun', seed }, data);
  let minBaseHp = state.baseHp;
  let endTurns = 0;
  let coinsAfterLastShop = 0;
  const turnsPerWave: number[] = Array.from({ length: data.waves.waves.length }, () => 0);
  const shops: ShopVisitStats[] = [];
  const waveEntries: WaveEntrySnapshot[] = [];
  let capturedEntry = -1;

  while (state.phase !== 'won' && state.phase !== 'lost') {
    if (endTurns >= MAX_END_TURNS) {
      throw new Error(`seed ${seed}: run didn't finish within ${MAX_END_TURNS} End Turns`);
    }

    if (state.phase === 'planning' && capturedEntry !== state.waveIndex) {
      capturedEntry = state.waveIndex;
      const hps = [
        ...state.board.robots.map((robot) => robot.hp),
        ...state.pendingSpawns.map((entry) => entry.hp),
      ];
      waveEntries.push({
        waveIndex: state.waveIndex,
        hps,
        values: reachableBallValues(state, data),
      });
    }

    if (state.phase === 'waveCleared') {
      state = applyOk(state, { type: 'openShop' }, data);
      continue;
    }

    if (state.phase === 'shop') {
      const afterWave = state.shop!.afterWave;
      const coinsOnEnter = state.coins;
      const cannonOffer = state.shop!.offers.find((offer) => offer.kind === 'cannon');
      const cannonAffordable =
        cannonOffer !== undefined &&
        !cannonOffer.bought &&
        cannonOffer.available &&
        cannonOffer.price <= state.coins;
      const hadAffordable = shopHasAffordable(state);
      const bought = applyShopPolicy(state, data);
      state = bought.state;
      shops.push({
        afterWave,
        coinsOnEnter,
        earned: coinsOnEnter - coinsAfterLastShop,
        spent: bought.spent,
        leftover: state.coins,
        purchases: bought.purchases,
        hadAffordable,
        cannonAffordable: cannonAffordable || cannonCount(state) >= 2,
      });
      coinsAfterLastShop = state.coins;
      state = applyOk(state, { type: 'nextWave' }, data);
      continue;
    }

    const planned = applyPlanningPolicy(state, data);
    const result = requireOk(applyCommand(planned.state, { type: 'endTurn' }, data));
    endTurns += 1;
    turnsPerWave[state.waveIndex] = (turnsPerWave[state.waveIndex] ?? 0) + 1;
    state = result.state;
    if (state.baseHp < minBaseHp) minBaseHp = state.baseHp;
  }

  return {
    seed,
    phase: state.phase,
    baseHp: state.baseHp,
    minBaseHp,
    endTurns,
    turnsPerWave,
    shops,
    waveEntries,
  };
}

export function playEndTurnOnlyRun(seed: string, data: GameData): RunState {
  let state = applyOk(null, { type: 'newRun', seed }, data);
  let endTurns = 0;
  while (state.phase !== 'won' && state.phase !== 'lost') {
    if (endTurns >= MAX_END_TURNS) {
      throw new Error(`seed ${seed}: run didn't finish within ${MAX_END_TURNS} End Turns`);
    }
    if (state.phase === 'waveCleared') {
      state = applyOk(state, { type: 'openShop' }, data);
      continue;
    }
    if (state.phase === 'shop') {
      state = applyOk(state, { type: 'nextWave' }, data);
      continue;
    }
    state = applyOk(state, { type: 'endTurn' }, data);
    endTurns += 1;
  }
  return state;
}
