// Main menu (task 11 req. 2): one big ▶ Play button that starts the first puzzle level. The title
// and the tile chips are decoration only — nothing here needs reading.
import type { CSSProperties } from 'react';
import { playFromStart } from '../state/levelFlow';
import { PlayIcon } from './icons';
import { useAppStore, useAppStoreApi } from './StoreContext';

export function MainMenu() {
  const store = useAppStoreApi();
  const tileColors = useAppStore((state) => state.data.presentation.tileColors);
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);

  return (
    <div
      className="screen"
      data-testid="main-menu"
      style={{ '--pop-in-ms': `${popInMs}ms` } as CSSProperties}
    >
      <h1 className="screen-title">Math Tactics</h1>
      <div className="menu-chips" aria-hidden="true">
        <span className="menu-chip menu-chip-ball">1</span>
        <span className="menu-chip" style={{ background: tileColors.green }}>
          +4
        </span>
        <span className="menu-chip" style={{ background: tileColors.orange }}>
          ×3
        </span>
        <span className="menu-chip" style={{ background: tileColors.blue }}>
          −2
        </span>
      </div>
      <button
        type="button"
        className="big-button pop-in"
        data-testid="menu-play"
        aria-label="Play"
        onClick={() => playFromStart(store)}
      >
        <PlayIcon size={96} />
      </button>
    </div>
  );
}
