// Puzzle-book flow (task 32, GDD §10.8): the picker, starting / replaying a scenario, the
// wave-cleared Next that skips the shop, and Home/Back returning to the grid. Framework-free.

import type { StoreApi } from 'zustand/vanilla';
import type { PuzzleDef } from '../../sim/data/schemas';
import { isPlaybackActive, type AppStore } from './store';

export function isPuzzlePlayable(puzzle: PuzzleDef): puzzle is PuzzleDef & { waves: NonNullable<PuzzleDef['waves']> } {
  return puzzle.waves !== undefined && puzzle.waves.length > 0;
}

export function openPuzzleBook(store: StoreApi<AppStore>): void {
  store.getState().setScreen('levelSelect');
}

export function leavePuzzleBook(store: StoreApi<AppStore>): void {
  store.getState().setScreen('menu');
}

export function startPuzzle(store: StoreApi<AppStore>, puzzleId: string): void {
  const { data } = store.getState();
  const puzzle = data.puzzles.puzzles.find((entry) => entry.id === puzzleId);
  if (!puzzle || !isPuzzlePlayable(puzzle)) return;
  store.getState().dispatch({ type: 'loadPuzzle', puzzleId });
  store.getState().setScreen('game');
}

export function continuePuzzleWave(store: StoreApi<AppStore>): void {
  const { run } = store.getState();
  if (run === null || run.mode !== 'puzzle' || run.phase !== 'waveCleared') return;
  store.getState().dispatch({ type: 'nextWave' });
}

export function returnToPuzzleBook(store: StoreApi<AppStore>): void {
  if (isPlaybackActive(store.getState())) return;
  store.getState().setScreen('levelSelect');
}

export function replayPuzzle(store: StoreApi<AppStore>): void {
  const { run } = store.getState();
  if (run === null || run.mode !== 'puzzle' || !run.puzzleId) return;
  startPuzzle(store, run.puzzleId);
}

/** Authored tiles only, easy → hard. Catalog stubs stay hidden until they have waves. */
export function puzzleBookTiles(puzzles: PuzzleDef[]): PuzzleDef[] {
  return puzzles
    .map((puzzle, index) => ({ puzzle, index }))
    .filter(({ puzzle }) => isPuzzlePlayable(puzzle))
    .sort((a, b) => a.puzzle.stars - b.puzzle.stars || a.index - b.index)
    .map(({ puzzle }) => puzzle);
}
