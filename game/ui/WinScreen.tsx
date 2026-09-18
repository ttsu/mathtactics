// Win screen (task 16 req. 2): the biggest celebration in the app so far — more and bigger stars
// plus a burst of confetti, placeholder shapes (GDD §10.6) — every wave dot filled, the
// exact-kill row, and a big ▶ back to the menu. Task 14 owns switching `screen` to `'won'` and
// clearing the save; this component only renders once it's there.
import type { CSSProperties } from 'react';
import { waveCount } from '../state/waveFlow';
import { ExactKillRow } from './ExactKillRow';
import { PlayIcon, StarIcon } from './icons';
import { SecretTap } from './debug';
import { LevelDots } from './LevelDots';
import { useAppStore, useAppStoreApi } from './StoreContext';

const CONFETTI_COLORS = ['#ff8c42', '#4caf50', '#2196f3', '#ffd166', '#e63946', '#3f9e8f'];

export function WinScreen() {
  const store = useAppStoreApi();
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);
  const count = useAppStore((state) => waveCount(state.data));
  const exactKills = useAppStore((state) => state.run?.exactKills ?? 0);

  return (
    <div
      className="screen"
      data-testid="won"
      style={{ '--pop-in-ms': `${popInMs}ms` } as CSSProperties}
    >
      <SecretTap testId="won-star">
        <div className="win-celebration pop-in" aria-hidden="true">
          <div className="confetti">
            {CONFETTI_COLORS.map((color) => (
              <span key={color} className="confetti-dot" style={{ background: color }} />
            ))}
          </div>
          <div className="win-stars">
            <StarIcon size={150} />
            <StarIcon size={220} />
            <StarIcon size={300} />
            <StarIcon size={220} />
            <StarIcon size={150} />
          </div>
        </div>
      </SecretTap>
      <LevelDots index={count - 1} count={count} cleared size="large" />
      <ExactKillRow count={exactKills} />
      <button
        type="button"
        className="big-button pop-in"
        data-testid="won-menu"
        aria-label="Menu"
        onClick={() => store.getState().setScreen('menu')}
      >
        <PlayIcon size={96} />
      </button>
    </div>
  );
}
