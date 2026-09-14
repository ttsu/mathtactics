// Level-cleared celebration (task 11 req. 2): a big star, the level dots with this level filled in,
// and a big ▶ Next. Shown only once the level is cleared and the final kill has finished playing
// (`showLevelCleared`). The wash covers the board so nothing else can be dragged or tapped.
import type { CSSProperties } from 'react';
import { continueToNextLevel, levelPosition, showLevelCleared } from '../state/levelFlow';
import { PlayIcon, StarIcon } from './icons';
import { LevelDots } from './LevelDots';
import { useAppStore, useAppStoreApi } from './StoreContext';

export function LevelClearedOverlay() {
  const store = useAppStoreApi();
  const visible = useAppStore(showLevelCleared);
  const levelIndex = useAppStore(
    (state) => levelPosition(state.data, state.run?.levelId)?.index ?? null,
  );
  const levelCount = useAppStore((state) => state.data.levels.levels.length);
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);

  if (!visible) return null;

  return (
    <div
      className="overlay-wash"
      data-testid="level-cleared"
      style={{ '--pop-in-ms': `${popInMs}ms` } as CSSProperties}
    >
      <div className="pop-in">
        <StarIcon size={260} />
      </div>
      {levelIndex !== null && (
        <LevelDots index={levelIndex} count={levelCount} cleared size="large" />
      )}
      <button
        type="button"
        className="big-button pop-in"
        data-testid="level-next"
        aria-label="Next"
        onClick={() => continueToNextLevel(store)}
      >
        <PlayIcon size={96} />
      </button>
    </div>
  );
}
