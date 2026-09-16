// `resolveTurn` (TR §6): the single entry point `endTurn` calls. Order (GDD §4): FIRE ->
// ADVANCE -> DETONATE -> END CHECK -> SPAWN. `mode: 'level'` (M1 puzzles) only ever runs FIRE
// (TR §4.1). `mode: 'run'` (M2, task 13) runs the full turn below.

import type { GameEvent, RunState } from '../core/types';
import type { GameData } from '../data/schemas';
import { spawn } from '../waves/spawn';
import { advance } from './advance';
import { detonate } from './detonate';
import { resolveFire } from './fire';

export interface ResolveTurnResult {
  state: RunState;
  events: GameEvent[];
}

export function resolveTurn(state: RunState, data: GameData): ResolveTurnResult {
  const fire = resolveFire(state, data);
  const events: GameEvent[] = [...fire.events];

  // Exact kills count for the whole run in any mode (task 13 requirement 2) — FIRE is the only
  // step that can ever produce a `RobotDefeated` (ADVANCE/DETONATE never do), so counting here,
  // once, covers both `level` and `run`.
  const exactKillsThisTurn = fire.events.filter(
    (event) => event.type === 'RobotDefeated' && event.exact,
  ).length;

  let nextState: RunState = {
    ...state,
    board: fire.board,
    coins: fire.coins,
    nextIds: fire.nextIds,
    exactKills: state.exactKills + exactKillsThisTurn,
    // Undo history never survives End Turn, in any mode (GDD §4.3).
    undo: [],
  };

  if (state.mode === 'level') {
    // TR §4.1: level mode is FIRE-only. It clears when every robot on the level is gone.
    if (fire.board.robots.length === 0) {
      nextState = { ...nextState, phase: 'levelCleared' };
      events.push({
        step: events.length,
        group: 'end',
        type: 'LevelCleared',
        levelId: state.levelId!,
      });
    }
  } else {
    // --- ADVANCE (GDD §4 step 4) ---
    const adv = advance(nextState.board, events.length);
    events.push(...adv.events);
    nextState = { ...nextState, board: { ...nextState.board, robots: adv.robots } };

    // --- DETONATE (GDD §4 step 4, §7.2) ---
    const det = detonate(adv.detonating, nextState.baseHp, events.length);
    events.push(...det.events);
    nextState = { ...nextState, baseHp: det.baseHp };

    // --- END CHECK (GDD §4 step 5) ---
    if (nextState.baseHp <= 0) {
      // A loss on the same turn the wave would also clear wins (GDD §4.1) — checked first.
      events.push({ step: events.length, group: 'end', type: 'RunLost' });
      nextState = { ...nextState, phase: 'lost' };
    } else if (nextState.pendingSpawns.length === 0 && nextState.board.robots.length === 0) {
      // Every scheduled robot has spawned and none remain (on-board or waiting): wave cleared.
      events.push({
        step: events.length,
        group: 'end',
        type: 'WaveCleared',
        waveIndex: nextState.waveIndex,
      });

      const waveCoins = data.economy.income.waveCleared;
      const coins = nextState.coins + waveCoins;
      events.push({
        step: events.length,
        group: 'end',
        type: 'CoinsChanged',
        delta: waveCoins,
        total: coins,
        reason: 'waveCleared',
      });
      nextState = { ...nextState, coins };

      const isLastWave = nextState.waveIndex === data.waves.waves.length - 1;
      if (isLastWave) {
        events.push({ step: events.length, group: 'end', type: 'RunWon' });
        nextState = { ...nextState, phase: 'won' };
      } else {
        // The shop (opened from this overlay) is the only way tiles enter a run (GDD §10.5).
        nextState = { ...nextState, phase: 'waveCleared' };
      }
    } else {
      // --- Continue: next turn, fast-forward, then SPAWN ---
      let turn = nextState.turn + 1;

      // Fast-forward (GDD §4.4): an empty board (no robots on-board or waiting) with spawns
      // still scheduled jumps straight to the next scheduled turn — the player never taps
      // End Turn on an empty board.
      if (nextState.board.robots.length === 0 && nextState.pendingSpawns.length > 0) {
        const nextScheduledTurn = nextState.pendingSpawns[0]!.turn;
        if (nextScheduledTurn > turn) turn = nextScheduledTurn;
      }
      nextState = { ...nextState, turn };

      const spawned = spawn(nextState, data, events.length);
      events.push(...spawned.events);
      nextState = spawned.state;
    }
  }

  nextState = { ...nextState, lastTurnEvents: events };
  return { state: nextState, events };
}
