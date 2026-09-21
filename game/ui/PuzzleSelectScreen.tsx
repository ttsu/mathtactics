// Puzzle book (task 32, GDD §10.8): playable catalog tiles, easy first. Catalog stubs stay
// hidden. Back returns to the menu.
import type { CSSProperties } from 'react';
import { MIN_TOUCH_TARGET } from '../state/designSpace';
import { playUiTap } from '../state/audio';
import { leavePuzzleBook, puzzleBookTiles, startPuzzle } from '../state/puzzleFlow';
import { BackIcon, CheckIcon, StarIcon } from './icons';
import { useAppStore, useAppStoreApi } from './StoreContext';

export function PuzzleSelectScreen() {
  const store = useAppStoreApi();
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);
  const tiles = useAppStore((state) => puzzleBookTiles(state.data.puzzles.puzzles));
  const completed = useAppStore((state) => state.completedPuzzles);

  return (
    <div
      className="screen puzzle-book"
      data-testid="puzzle-select"
      style={{ '--pop-in-ms': `${popInMs}ms` } as CSSProperties}
    >
      <button
        type="button"
        className="screen-back pop-in"
        data-testid="puzzle-select-back"
        aria-label="Back"
        style={{ minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET }}
        onClick={() => {
          playUiTap();
          leavePuzzleBook(store);
        }}
      >
        <BackIcon size={32} />
        <span className="button-label button-label-small">Back</span>
      </button>
      <div className="puzzle-grid" data-testid="puzzle-grid">
        {tiles.map((puzzle) => {
          const done = completed.includes(puzzle.id);
          return (
            <button
              key={puzzle.id}
              type="button"
              className="puzzle-tile pop-in"
              data-testid={`puzzle-${puzzle.id}`}
              aria-label={puzzle.name}
              onClick={() => {
                playUiTap();
                startPuzzle(store, puzzle.id);
              }}
            >
              <span className="puzzle-tile-stars" aria-hidden="true">
                {Array.from({ length: puzzle.stars }, (_, i) => (
                  <StarIcon key={i} size={22} />
                ))}
              </span>
              <span className="puzzle-tile-name">{puzzle.name}</span>
              {done && (
                <span className="puzzle-tile-check" data-testid={`puzzle-check-${puzzle.id}`}>
                  <CheckIcon size={28} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
