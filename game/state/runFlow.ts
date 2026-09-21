// The M2 run flow (task 14): ▶ Continue / New Run, the seed made at the edge (never in `/sim`,
// CLAUDE.md rule 1), and ⌂ Home — mirroring the M1 puzzle-level flow in `levelFlow.ts`.
//
// Continue reads `state.savedRun`, a memory copy of the `run` storage key kept up to date by the
// store's `dispatch`/`finishPlayback` (see its doc comment in `store.ts`) — not a fresh storage
// read. That copy still reflects the saved run after Puzzles has replaced `run` in memory for the
// current session, since a level-mode dispatch never touches it (task 14 req. 1). See the task
// report for why this was chosen over reading storage directly here.

import type { StoreApi } from 'zustand/vanilla';
import type { DifficultyId, RunState } from '../../sim/core/types';
import {
  displayFromRun,
  IDLE_PLAYBACK,
  isPlaybackActive,
  type AppState,
  type AppStore,
} from './store';

/** A saved run the player can resume into (GDD §10.4, task 14 req. 2): still mid-run, not yet
 * won/lost. */
export function isResumable(run: RunState | null): run is RunState {
  return (
    run !== null &&
    run.mode === 'run' &&
    (run.phase === 'planning' || run.phase === 'waveCleared' || run.phase === 'shop')
  );
}

/** Whether ▶ Continue should be offered on the main menu (task 14 req. 3). */
export function canContinue(state: Pick<AppState, 'savedRun'>): boolean {
  return isResumable(state.savedRun);
}

/** ▶ Continue: installs the saved run as-is (including a `waveCleared` or `shop` phase — its
 * overlay/screen just reappears), no playback, and no Replay snapshot (there is none after a
 * reload). A shop-phase save lands on `screen: 'shop'`; every other resumable phase lands on
 * `'game'`. Ignored if nothing is resumable, so a stray tap can't clobber `run`. */
export function continueRun(store: StoreApi<AppStore>): void {
  const { savedRun } = store.getState();
  if (!isResumable(savedRun)) return;
  store.setState({
    run: savedRun,
    display: displayFromRun(savedRun),
    playback: { ...IDLE_PLAYBACK },
    lastTurn: null,
    screen: savedRun.phase === 'shop' ? 'shop' : 'game',
  });
}

/** A fresh per-run seed. `/sim` never touches the clock or `crypto` (CLAUDE.md rule 1) — this is
 * the edge that does, once per run. */
function newRunSeed(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `run:${Date.now()}:${random}`;
}

/** ▶ New Game: replaces any saved run (`dispatch` persists the fresh one, since its `mode` is
 * `'run'`) and shows the game screen. Difficulty comes from the picker tap, or from the Settings
 * default when the helper is called without one (unit tests, debug). The wave-1 spawn events
 * returned by `newRun` play back like any other resolution; `dispatch` keeps Replay off for them
 * (task 14 req. 2). */
export function startNewRun(store: StoreApi<AppStore>, difficulty?: DifficultyId): void {
  const chosen = difficulty ?? store.getState().settings.difficulty;
  store.getState().dispatch({ type: 'newRun', seed: newRunSeed(), difficulty: chosen });
  store.getState().setScreen('game');
}

/** ⌂ Home: back to the menu, with no confirmation (GDD §10.4). A run is already saved and a
 * puzzle session is simply dropped, so this never touches `run`/`savedRun` — only refused while
 * playback is active, so a tap can't jump away from an animation still in flight. From a
 * puzzle session, Home returns to the puzzle book (GDD §10.8). */
export function goHome(store: StoreApi<AppStore>): void {
  const state = store.getState();
  if (isPlaybackActive(state)) return;
  if (state.run?.mode === 'puzzle') {
    state.setScreen('levelSelect');
    return;
  }
  state.setScreen('menu');
}
