// Main menu (task 11 req. 2, task 14 req. 3, task 24): ▶ Keep Going (big, only when a run is
// resumable), New Game (big when there is nothing to continue, smaller otherwise), Puzzles
// (always smaller), and Settings (always smaller). The title and the tile chips are decoration
// only.
//
// Each button carries a short label under its icon (GDD §11.1, v0.5). The icons alone were
// ambiguous — nothing said what ▶ versus 🤖 would do. The labels only repeat what the icon
// means, so a pre-reader can still use the menu by icon and position alone.
import type { CSSProperties } from 'react';
import { playFromStart } from '../state/levelFlow';
import { canContinue, continueRun, startNewRun } from '../state/runFlow';
import { GearIcon, PlayIcon, RobotPlayIcon, TileChipIcon } from './icons';
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
        {resumable ? (
          <button
            type="button"
            className="big-button pop-in"
            data-testid="menu-continue"
            aria-label="Keep Going"
            onClick={() => continueRun(store)}
          >
            <PlayIcon size={96} />
            <span className="button-label">Keep Going</span>
          </button>
        ) : (
          <button
            type="button"
            className="big-button pop-in"
            data-testid="menu-new-run"
            aria-label="New Game"
            onClick={() => startNewRun(store)}
          >
            <RobotPlayIcon size={96} />
            <span className="button-label">New Game</span>
          </button>
        )}
        <div className="menu-buttons-row">
          {resumable && (
            <button
              type="button"
              className="small-button pop-in"
              data-testid="menu-new-run"
              aria-label="New Game"
              onClick={() => startNewRun(store)}
            >
              <RobotPlayIcon size={56} />
              <span className="button-label button-label-small">New Game</span>
            </button>
          )}
          <button
            type="button"
            className="small-button pop-in"
            data-testid="menu-puzzles"
            aria-label="Puzzles"
            onClick={() => playFromStart(store)}
          >
            <TileChipIcon size={56} />
            <span className="button-label button-label-small">Puzzles</span>
          </button>
          <button
            type="button"
            className="small-button pop-in"
            data-testid="menu-settings"
            aria-label="Settings"
            onClick={() => store.getState().setScreen('settings')}
          >
            <GearIcon size={56} />
            <span className="button-label button-label-small">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
