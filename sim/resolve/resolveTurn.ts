// `resolveTurn` (TR §6): the single entry point `endTurn` calls. Order (GDD §4): FIRE ->
// ADVANCE -> DETONATE -> END CHECK -> SPAWN. M1's `mode: 'level'` puzzles only ever run FIRE
// (TR §4.1) — ADVANCE/DETONATE/END CHECK/SPAWN arrive with `mode: 'run'` in M2.

import type { GameEvent, RunState } from '../core/types';
import type { GameData } from '../data/schemas';
import { resolveFire } from './fire';

export interface ResolveTurnResult {
  state: RunState;
  events: GameEvent[];
}

export function resolveTurn(state: RunState, data: GameData): ResolveTurnResult {
  const fire = resolveFire(state, data);
  const events: GameEvent[] = [...fire.events];

  let nextState: RunState = {
    ...state,
    board: fire.board,
    coins: fire.coins,
    nextIds: fire.nextIds,
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
    // TODO(M2): advance, detonate, end check, spawn
  }

  nextState = { ...nextState, lastTurnEvents: events };
  return { state: nextState, events };
}
