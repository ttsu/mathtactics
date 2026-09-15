// The M1 puzzle-level sequence (task 11): which level comes next, where the player is in the
// sequence, when the level-cleared overlay shows, and the three flow steps the React screens
// trigger (▶ Play, ▶ Next, ▶ Play again). Framework-free so it is unit-testable; level progress
// lives only in memory — the current level is simply `run.levelId` (no save in M1).

import type { StoreApi } from 'zustand/vanilla';
import type { GameData } from '../../sim/data/schemas';
import { isPlaybackActive, type AppState, type AppStore } from './store';

/** Where a level sits in the shipped sequence (`data/levels.json` order). */
export interface LevelPosition {
  /** 0-based. */
  index: number;
  count: number;
}

/** The position of `levelId` in the shipped sequence, or `null` if it isn't a shipped level
 * (e.g. a scenario installed by the test handle). */
export function levelPosition(data: GameData, levelId: string | undefined): LevelPosition | null {
  const levels = data.levels.levels;
  const index = levels.findIndex((level) => level.id === levelId);
  return index === -1 ? null : { index, count: levels.length };
}

/** The level to play first. Throws if `levels.json` ships none — the flow has nothing to show. */
export function firstLevelId(data: GameData): string {
  const first = data.levels.levels[0];
  if (!first) throw new Error('levels.json has no levels');
  return first.id;
}

/** The level after `levelId`, or `null` when `levelId` is the last shipped level (→ all done). A
 * level that isn't in the sequence continues with the first level. */
export function nextLevelId(data: GameData, levelId: string | undefined): string | null {
  const position = levelPosition(data, levelId);
  if (position === null) return firstLevelId(data);
  return data.levels.levels[position.index + 1]?.id ?? null;
}

/** The level-cleared overlay shows once a level is cleared **and** its playback has finished, so
 * the final kill beat always plays first (task 11 ruling). */
export function showLevelCleared(state: Pick<AppState, 'run' | 'playback' | 'screen'>): boolean {
  return (
    state.screen === 'game' &&
    state.run !== null &&
    state.run.phase === 'levelCleared' &&
    !isPlaybackActive(state)
  );
}

/** Loads `levelId` and shows the board. */
export function startLevel(store: StoreApi<AppStore>, levelId: string): void {
  const state = store.getState();
  state.dispatch({ type: 'loadLevel', levelId });
  state.setScreen('game');
}

/** ▶ Play (main menu) and ▶ Play again (all-done screen): start from the first level. */
export function playFromStart(store: StoreApi<AppStore>): void {
  startLevel(store, firstLevelId(store.getState().data));
}

/** ▶ Next (level-cleared overlay): the next level, or the all-done screen after the last one.
 * Ignored unless a level is cleared, so a double tap can't skip a level. */
export function continueToNextLevel(store: StoreApi<AppStore>): void {
  const { data, run } = store.getState();
  if (run === null || run.phase !== 'levelCleared') return;
  const next = nextLevelId(data, run?.levelId);
  if (next === null) {
    store.getState().setScreen('allDone');
  } else {
    startLevel(store, next);
  }
}
