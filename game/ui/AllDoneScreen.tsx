// "All done" (task 11 req. 2): shown after the last puzzle level. Three big stars, every level dot
// filled, and a big ▶ Play again that goes back to the first level.
import type { CSSProperties } from 'react';
import { playFromStart } from '../state/levelFlow';
import { PlayAgainIcon, StarIcon } from './icons';
import { SecretTap } from './debug';
import { LevelDots } from './LevelDots';
import { useAppStore, useAppStoreApi } from './StoreContext';

export function AllDoneScreen() {
  const store = useAppStoreApi();
  const levelCount = useAppStore((state) => state.data.levels.levels.length);
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);

  return (
    <div
      className="screen"
      data-testid="all-done"
      style={{ '--pop-in-ms': `${popInMs}ms` } as CSSProperties}
    >
      <SecretTap testId="all-done-stars">
        <div className="all-done-stars pop-in">
          <StarIcon size={180} />
          <StarIcon size={240} />
          <StarIcon size={180} />
        </div>
      </SecretTap>
      <LevelDots index={levelCount - 1} count={levelCount} cleared size="large" />
      <button
        type="button"
        className="big-button pop-in"
        data-testid="all-done-play-again"
        aria-label="Play again"
        onClick={() => playFromStart(store)}
      >
        <PlayAgainIcon size={104} />
      </button>
    </div>
  );
}
