// Main menu (task 11 req. 2, task 14 req. 3): ▶ Continue (big, only when a run is resumable),
// New Run (big when there is nothing to continue, smaller otherwise), and Puzzles (always
// smaller) → the existing level flow. The title and the tile chips are decoration only — nothing
// here needs reading.
import type { CSSProperties } from 'react';
import { playFromStart } from '../state/levelFlow';
import { canContinue, continueRun, startNewRun } from '../state/runFlow';
import { PlayIcon, RobotPlayIcon, TileChipIcon } from './icons';
import { useAppStore, useAppStoreApi } from './StoreContext';

export function MainMenu() {
  const store = useAppStoreApi();
  const tileColors = useAppStore((state) => state.data.presentation.tileColors);
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);
  const resumable = useAppStore(canContinue);

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
      <div className="menu-buttons">
        {resumable && (
          <button
            type="button"
            className="big-button pop-in"
            data-testid="menu-continue"
            aria-label="Continue"
            onClick={() => continueRun(store)}
          >
            <PlayIcon size={96} />
          </button>
        )}
        <div className="menu-buttons-row">
          <button
            type="button"
            className={resumable ? 'small-button pop-in' : 'big-button pop-in'}
            data-testid="menu-new-run"
            aria-label="New Run"
            onClick={() => startNewRun(store)}
          >
            <RobotPlayIcon size={resumable ? 56 : 96} />
          </button>
          <button
            type="button"
            className="small-button pop-in"
            data-testid="menu-puzzles"
            aria-label="Puzzles"
            onClick={() => playFromStart(store)}
          >
            <TileChipIcon size={56} />
          </button>
        </div>
      </div>
    </div>
  );
}
