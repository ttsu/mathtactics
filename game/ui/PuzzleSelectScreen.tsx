// Puzzle book (task 32, GDD §10.8): a 10×5 grid of every catalog entry. Playable tiles start
// the scenario; locked tiles (no waves yet) shake and do nothing. Back returns to the menu.
import { useState, type CSSProperties } from 'react';
import { MIN_TOUCH_TARGET } from '../state/designSpace';
import { playUiTap } from '../state/audio';
import {
  isPuzzlePlayable,
  leavePuzzleBook,
  startPuzzle,
} from '../state/puzzleFlow';
import { BackIcon, CheckIcon, LockIcon, StarIcon } from './icons';
import { useAppStore, useAppStoreApi } from './StoreContext';

export function PuzzleSelectScreen() {
  const store = useAppStoreApi();
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);
  const puzzles = useAppStore((state) => state.data.puzzles.puzzles);
  const completed = useAppStore((state) => state.completedPuzzles);
  const [shakingId, setShakingId] = useState<string | null>(null);

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
        {puzzles.map((puzzle) => {
          const playable = isPuzzlePlayable(puzzle);
          const done = completed.includes(puzzle.id);
          return (
            <button
              key={puzzle.id}
              type="button"
              className={`puzzle-tile pop-in${playable ? '' : ' is-locked'}${
                shakingId === puzzle.id ? ' is-shaking' : ''
              }`}
              data-testid={`puzzle-${puzzle.id}`}
              aria-label={puzzle.name}
              aria-disabled={!playable}
              onClick={() => {
                if (!playable) {
                  setShakingId(puzzle.id);
                  return;
                }
                playUiTap();
                startPuzzle(store, puzzle.id);
              }}
              onAnimationEnd={() => {
                if (shakingId === puzzle.id) setShakingId(null);
              }}
            >
              <span className="puzzle-tile-stars" aria-hidden="true">
                {Array.from({ length: puzzle.stars }, (_, i) => (
                  <StarIcon key={i} size={14} />
                ))}
              </span>
              <span className="puzzle-tile-name">{puzzle.name}</span>
              {done && (
                <span className="puzzle-tile-check" data-testid={`puzzle-check-${puzzle.id}`}>
                  <CheckIcon size={22} />
                </span>
              )}
              {!playable && (
                <span className="puzzle-tile-lock" data-testid={`puzzle-lock-${puzzle.id}`}>
                  <LockIcon size={20} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
