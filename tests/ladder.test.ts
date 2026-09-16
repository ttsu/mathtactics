// Task 17 balance checks for the ladder's finalized `waves.json` (GDD §10.1–10.3, §10.5). Uses
// the real shipped data (`parseGameData(loadRawGameData())`) and the real command pipeline
// (`applyCommand`) — no reimplementation of turn resolution — for seeds 1–100.

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../sim/commands/applyCommand';
import { parseGameData } from '../sim/data/load';
import type { GameData, WaveDef } from '../sim/data/schemas';
import type { Board, GameEvent, RunState, TileId } from '../sim/core/types';
import type { Lane } from '../sim/core/coords';
import { loadRawGameData } from './helpers/loadDataFiles';

const data: GameData = parseGameData(loadRawGameData());

const SEEDS = Array.from({ length: 100 }, (_, i) => String(i + 1));

function requireOk<T extends { ok: boolean }>(result: T): T & { ok: true } {
  if (!result.ok) {
    throw new Error(`command failed: ${JSON.stringify(result)}`);
  }
  return result as T & { ok: true };
}

function newRun(seed: string): RunState {
  return requireOk(applyCommand(null, { type: 'newRun', seed }, data)).state;
}

// --- Requirement: worst-case full-run detonation total stays under 100 (the unlosable-M2
// decision, GDD §10.5 / task 17 context) ---

function worstCaseDetonationTotal(waves: WaveDef[]): number {
  let total = 0;
  for (const wave of waves) {
    for (const spawn of wave.spawns) {
      total += spawn.hp[1]; // max of the [min, max] range
    }
  }
  return total;
}

describe('unlosable-M2 decision', () => {
  it('worst-case full-run detonation total (every robot detonates at full HP) stays under 100', () => {
    const total = worstCaseDetonationTotal(data.waves.waves);
    expect(total).toBeLessThan(100);
  });
});

// --- Requirement: every wave-2 robot exact-killable in <=2 hits with wave-1 reward tiles (+
// base value 1); every wave-3 robot likewise with wave-1 + wave-2 rewards ---

/** Every ball value reachable in one shot from `base`, chaining any subset (in any order) of
 * `tileIds` — mirrors what a player can actually place in a lane's 7 tile cells. Small tile
 * counts (a wave's cumulative rewards) keep the permutation count tiny. */
function reachableSingleShotValues(base: number, tileIds: TileId[]): Set<number> {
  const tileDefs = tileIds.map((id) => {
    const def = data.tiles.find((tile) => tile.id === id);
    if (!def) throw new Error(`reachableSingleShotValues: unknown tile id "${id}"`);
    return def;
  });

  const reachable = new Set<number>([base]);

  function visit(remaining: typeof tileDefs, current: number) {
    reachable.add(current);
    for (let i = 0; i < remaining.length; i++) {
      const tile = remaining[i]!;
      const rest = [...remaining.slice(0, i), ...remaining.slice(i + 1)];
      const next =
        tile.kind === 'add' ? current + tile.n : tile.kind === 'sub' ? current - tile.n : current * tile.n;
      visit(rest, next);
    }
  }

  visit(tileDefs, base);
  return reachable;
}

/** Whether `hp` can be exactly reduced to 0 in at most two hits (turns), each hit dealing one
 * `reachable` value of damage in sequence (the first hit must not overshoot). */
function exactKillableInAtMostTwoHits(hp: number, reachable: Set<number>): boolean {
  if (reachable.has(hp)) return true; // one hit
  for (const first of reachable) {
    if (first > 0 && first < hp && reachable.has(hp - first)) return true;
  }
  return false;
}

function waveHpRange(wave: WaveDef): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const spawn of wave.spawns) {
    min = Math.min(min, spawn.hp[0]);
    max = Math.max(max, spawn.hp[1]);
  }
  return { min, max };
}

describe('exact-kill reachability (GDD §5.5 / task 17 requirement 2)', () => {
  const [wave1, wave2, wave3] = data.waves.waves;
  if (!wave1 || !wave2 || !wave3) {
    throw new Error('ladder balance tests expect at least 3 waves (wave-1, wave-2, wave-3)');
  }

  const wave1Reward = wave1.reward?.tiles ?? [];
  const wave2Reward = wave2.reward?.tiles ?? [];

  it('every wave-2 HP value is exact-killable in at most 2 hits using wave-1 reward tiles + base value 1', () => {
    const reachable = reachableSingleShotValues(1, wave1Reward);
    const { min, max } = waveHpRange(wave2);
    for (let hp = min; hp <= max; hp++) {
      expect(exactKillableInAtMostTwoHits(hp, reachable), `hp ${hp}`).toBe(true);
    }
  });

  it('every wave-3 HP value is exact-killable in at most 2 hits using wave-1 + wave-2 reward tiles + base value 1', () => {
    const reachable = reachableSingleShotValues(1, [...wave1Reward, ...wave2Reward]);
    const { min, max } = waveHpRange(wave3);
    for (let hp = min; hp <= max; hp++) {
      expect(exactKillableInAtMostTwoHits(hp, reachable), `hp ${hp}`).toBe(true);
    }
  });
});

// --- Requirement: a "sensible player" bot (move the cannon to the front-most robot's lane;
// fire; no tiles) finishes wave 1 with zero detonations for every seed ---

function cannonLane(board: Board): Lane {
  const lane = board.cannons.findIndex(Boolean);
  if (lane === -1) throw new Error('cannonLane: no cannon on the board');
  return lane as Lane;
}

function frontmostRobotLane(board: Board): Lane | null {
  const onBoard = board.robots.filter((robot) => robot.col !== null);
  if (onBoard.length === 0) return null;
  onBoard.sort((a, b) => a.col! - b.col! || a.lane - b.lane);
  return onBoard[0]!.lane;
}

/** Plays wave 1 (only) with the "sensible player" bot: every turn, move the cannon to the
 * front-most on-board robot's lane if it isn't already there, then End Turn. No tiles are ever
 * placed. Returns every `BaseDamaged` event seen. */
function playWave1WithFollowBot(seed: string): { finalPhase: RunState['phase']; damageEvents: GameEvent[] } {
  let state = newRun(seed);
  const damageEvents: GameEvent[] = [];
  const MAX_TURNS = 100;
  let turns = 0;

  while (state.waveIndex === 0 && state.phase === 'planning') {
    if (turns >= MAX_TURNS) {
      throw new Error(`seed ${seed}: wave 1 didn't clear within ${MAX_TURNS} turns`);
    }
    const target = frontmostRobotLane(state.board);
    const current = cannonLane(state.board);
    if (target !== null && target !== current) {
      state = requireOk(
        applyCommand(state, { type: 'moveCannon', fromLane: current, toLane: target }, data),
      ).state;
    }
    const result = requireOk(applyCommand(state, { type: 'endTurn' }, data));
    turns++;
    for (const event of result.events) {
      if (event.type === 'BaseDamaged') damageEvents.push(event);
    }
    state = result.state;
  }

  return { finalPhase: state.phase, damageEvents };
}

describe('sensible-player bot clears wave 1 with zero detonations (task 17 requirement 2)', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}`, () => {
      const { finalPhase, damageEvents } = playWave1WithFollowBot(seed);
      expect(damageEvents).toEqual([]);
      // Wave 1 is never the last wave in the shipped ladder, so clearing it moves to `waveCleared`.
      expect(finalPhase).toBe('waveCleared');
    });
  }
});

// --- Requirement: an End-Turn-only bot always finishes the run `won` with base HP > 0 ---

function playFullRunEndTurnOnly(seed: string): RunState {
  let state = newRun(seed);
  const MAX_END_TURNS = 300;
  let endTurns = 0;

  while (state.phase !== 'won' && state.phase !== 'lost') {
    if (endTurns >= MAX_END_TURNS) {
      throw new Error(`seed ${seed}: run didn't finish within ${MAX_END_TURNS} End Turns`);
    }
    const cmd = state.phase === 'waveCleared' ? { type: 'nextWave' as const } : { type: 'endTurn' as const };
    state = requireOk(applyCommand(state, cmd, data)).state;
    if (cmd.type === 'endTurn') endTurns++;
  }

  return state;
}

describe('End-Turn-only bot always wins with base HP > 0 (task 17 requirement 2, the unlosable claim)', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}`, () => {
      const finalState = playFullRunEndTurnOnly(seed);
      expect(finalState.phase).toBe('won');
      expect(finalState.baseHp).toBeGreaterThan(0);
    });
  }
});
