// Shared "sensible player" and End-Turn-only drivers for ladder balance tests and the
// full-run e2e (task 21). Every mutation goes through `applyCommand` — this file only
// chooses commands. Ball values reuse `applyTile` (GDD §5.3 / §9.2).

import { applyCommand } from '../../sim/commands/applyCommand';
import { robotAt, tileAt } from '../../sim/commands/boardQueries';
import type { Col, Lane } from '../../sim/core/coords';
import { COLS, lanes } from '../../sim/core/coords';
import { robotFootprint } from '../../sim/core/footprint';
import { applyTile } from '../../sim/core/tiles';
import type {
  Command,
  Robot,
  RunState,
  ShopOffer,
  ShopSlotId,
  TileDef,
  TileId,
} from '../../sim/core/types';
import type { GameData } from '../../sim/data/schemas';
import { resolveImpact } from '../../sim/resolve/impact';

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
  let best: Robot | null = null;
  let bestCol: Col | null = null;
  for (const robot of state.board.robots) {
    for (const cell of robotFootprint(robot)) {
      if (cell.lane !== lane) continue;
      if (bestCol === null || cell.col < bestCol) {
        best = robot;
        bestCol = cell.col;
      }
    }
  }
  return best;
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

/**
 * Rank a candidate ball through `resolveImpact` (GDD §5.4): exact > undershoot > overshoot >
 * blocked. Bigger raw ball value breaks ties. A wrong-parity blocked ball is strictly worst.
 * Bounce-back overshoot (`bounceBack !== null`, `result === 'survive'`) ranks with overshoots,
 * not undershoots. Category: 2 exact, 1 undershoot, 0 overshoot, -1 blocked.
 */
export function arrangementRank(robot: Robot, value: number): [number, number] {
  const outcome = resolveImpact(robot, value);
  if (outcome.kind === 'blocked') return [-1, value];
  if (outcome.result === 'exact') return [2, value];
  if (outcome.result === 'kill' || outcome.bounceBack !== null) return [0, value];
  return [1, value];
}

export function betterRank(a: [number, number], b: [number, number]): boolean {
  if (a[0] !== b[0]) return a[0] > b[0];
  return a[1] > b[1];
}

export function bestSequence(
  state: RunState,
  data: GameData,
  pieceIds: string[],
  robot: Robot,
  kMax: number,
): string[] {
  const sequences = pieceSequences(pieceIds, kMax);
  let best: string[] = [];
  let bestRank: [number, number] = arrangementRank(robot, state.cannonBaseValue);
  for (const seq of sequences) {
    const defs = seq.map((pieceId) => {
      const piece = state.pieces[pieceId];
      if (!piece) throw new Error(`missing piece ${pieceId}`);
      return tileDef(data, piece.tileId);
    });
    const value = ballValue(state.cannonBaseValue, defs);
    const rank = arrangementRank(robot, value);
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

/**
 * True if some sequence of at most `n` hits, each a value from `values` (tiles are not consumed
 * — the same set is available every hit), exact-kills `robot` through `resolveImpact`. Overkill
 * (`result === 'kill'`) is not an exact kill — skip that shot and try another value, matching
 * task 21's `chip >= hp` continue. A blocked (wrong-parity) ball consumes a hit but does not
 * change HP. Bounce-back never emits `kill`; overshoot continues from `hpAfter` so a later
 * exact is still reachable. Success is only `result === 'exact'` (`hpAfter === 0`).
 */
export function canExactKillInAtMostNHits(robot: Robot, values: number[], n: number): boolean {
  const unique = [...new Set(values)];
  const failed = new Set<string>();

  const walk = (current: Robot, hitsLeft: number): boolean => {
    if (hitsLeft <= 0) return false;
    const key = `${current.hp}:${hitsLeft}`;
    if (failed.has(key)) return false;

    for (const value of unique) {
      const outcome = resolveImpact(current, value);
      if (outcome.kind === 'blocked') {
        if (walk(current, hitsLeft - 1)) return true;
        continue;
      }
      if (outcome.result === 'exact') return true;
      if (outcome.result === 'kill') continue;
      if (walk({ ...current, hp: outcome.hpAfter }, hitsLeft - 1)) return true;
    }

    failed.add(key);
    return false;
  };

  return walk(robot, n);
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

/** Cover threatened lanes with idle cannons; if none are covering anyone, park one
 * on the front-most robot (task 21 sensible-player move rule). */
function reassignCannons(state: RunState, data: GameData): { state: RunState; commands: Command[] } {
  const commands: Command[] = [];
  let next = state;

  const threatened = lanes()
    .map((lane) => {
      const robot = frontRobotInLane(next, lane);
      return robot ? { lane, col: robot.col! } : null;
    })
    .filter((row): row is { lane: Lane; col: Col } => row !== null)
    .sort((a, b) => a.col - b.col || a.lane - b.lane);

  const idleCannons = () =>
    lanes().filter((lane) => next.board.cannons[lane] && frontRobotInLane(next, lane) === null);

  for (const row of threatened) {
    if (next.board.cannons[row.lane]) continue;
    const fromLane = idleCannons()[0];
    if (fromLane === undefined) break;
    const cmd: Command = { type: 'moveCannon', fromLane, toLane: row.lane };
    next = applyOk(next, cmd, data);
    commands.push(cmd);
  }

  if (commands.length === 0) {
    const reachable = lanes().some(
      (lane) => next.board.cannons[lane] && frontRobotInLane(next, lane) !== null,
    );
    const target = frontmostRobotLane(next);
    if (!reachable && target !== null && !next.board.cannons[target]) {
      const fromLane = lanes().find((lane) => next.board.cannons[lane]);
      if (fromLane !== undefined) {
        const cmd: Command = { type: 'moveCannon', fromLane, toLane: target };
        next = applyOk(next, cmd, data);
        commands.push(cmd);
      }
    }
  }

  return { state: next, commands };
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
    const seq = bestSequence(next, data, available, job.robot, kMax);
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
  const moved = reassignCannons(returned.state, data);
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

  const tiles = affordable.filter((offer) => offer.kind === 'tile');
  const affordableMul = tiles.some((offer) => offer.kind === 'tile' && offer.tileId.startsWith('mul:'));
  const cannon = affordable.find((offer) => offer.kind === 'cannon');
  // Pick up a first ×N before a second cannon when both are on sale — otherwise
  // cannon-first spends the wave-2 ×2 guarantee and wave 4–7 cannot 2-hit.
  if (cannon && cannonCount(state) < 3 && (ownsMul(state) || !affordableMul)) {
    return { kind: 'buy', slot: cannon.slot };
  }

  if (tiles.length > 0) {
    const wantMul = !ownsMul(state) && affordableMul;
    const pool = wantMul
      ? tiles.filter((offer) => offer.kind === 'tile' && offer.tileId.startsWith('mul:'))
      : tiles;
    pool.sort((a, b) => {
      if (a.price !== b.price) return a.price - b.price;
      const kindRank = (offer: ShopOffer) => {
        if (offer.kind !== 'tile') return 9;
        if (offer.tileId.startsWith('add:')) return 0;
        if (offer.tileId.startsWith('mul:')) return 1;
        return 2;
      };
      if (kindRank(a) !== kindRank(b)) return kindRank(a) - kindRank(b);
      const nA = a.kind === 'tile' ? Number(a.tileId.split(':')[1]) : 0;
      const nB = b.kind === 'tile' ? Number(b.tileId.split(':')[1]) : 0;
      if (nA !== nB) return nB - nA;
      return a.slot.localeCompare(b.slot);
    });
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
  robots: Robot[];
  values: number[];
}

export interface SensibleRunStats {
  seed: string;
  phase: RunState['phase'];
  baseHp: number;
  minBaseHp: number;
  endTurns: number;
  turnsPerWave: number[];
  hpLostPerWave: number[];
  shops: ShopVisitStats[];
  waveEntries: WaveEntrySnapshot[];
}

/** Task 27 remeasured 10-wave End Turns at 50/66/92 (min/median/max). 400 still has
 * headroom so a bot that hits the cap throws rather than reporting a false loss. */
const MAX_END_TURNS = 400;

export function playSensibleRun(seed: string, data: GameData): SensibleRunStats {
  let state = applyOk(null, { type: 'newRun', seed }, data);
  let minBaseHp = state.baseHp;
  let endTurns = 0;
  let coinsAfterLastShop = 0;
  const turnsPerWave: number[] = Array.from({ length: data.waves.waves.length }, () => 0);
  const hpAtWaveStart: number[] = Array.from({ length: data.waves.waves.length }, () => state.baseHp);
  const hpLostPerWave: number[] = Array.from({ length: data.waves.waves.length }, () => 0);
  const shops: ShopVisitStats[] = [];
  const waveEntries: WaveEntrySnapshot[] = [];
  let capturedEntry = -1;

  while (state.phase !== 'won' && state.phase !== 'lost') {
    if (endTurns >= MAX_END_TURNS) {
      throw new Error(`seed ${seed}: run didn't finish within ${MAX_END_TURNS} End Turns`);
    }

    if (state.phase === 'planning' && capturedEntry !== state.waveIndex) {
      capturedEntry = state.waveIndex;
      hpAtWaveStart[state.waveIndex] = state.baseHp;
      const pendingRobots = state.pendingSpawns.map((entry, index) => {
        const template = data.robots.find((candidate) => candidate.id === entry.robotTemplateId);
        if (!template) {
          throw new Error(`unknown robot template "${entry.robotTemplateId}"`);
        }
        return {
          robotId: `pending:${index}`,
          lane: entry.lane,
          col: null,
          hp: entry.hp,
          maxHp: entry.hp,
          trait: template.trait,
          isBoss: template.isBoss,
        } satisfies Robot;
      });
      waveEntries.push({
        waveIndex: state.waveIndex,
        robots: [...state.board.robots.map((robot) => ({ ...robot })), ...pendingRobots],
        values: reachableBallValues(state, data),
      });
    }

    if (state.phase === 'waveCleared') {
      hpLostPerWave[state.waveIndex] = hpAtWaveStart[state.waveIndex]! - state.baseHp;
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

  hpLostPerWave[state.waveIndex] = hpAtWaveStart[state.waveIndex]! - state.baseHp;

  return {
    seed,
    phase: state.phase,
    baseHp: state.baseHp,
    minBaseHp,
    endTurns,
    turnsPerWave,
    hpLostPerWave,
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
