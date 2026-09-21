// Main menu (task 11 req. 2, task 14 req. 3, task 24): ▶ Continue (big, only when a run is
// resumable), New Game (big ▶ when there is nothing to continue; smaller ↺ otherwise), Puzzles
// (always smaller), and Settings (always smaller). The MATH VS ROBOTS title is decoration only.
//
// Each button carries a short label under its icon (GDD §11.1, v0.5). The icons alone were
// ambiguous — nothing said what ▶ versus ↺ would do. The labels only repeat what the icon
// means, so a pre-reader can still use the menu by icon and position alone.
import type { CSSProperties } from 'react';
import { playUiTap } from '../state/audio';
import { openPuzzleBook } from '../state/puzzleFlow';
import { canContinue, continueRun } from '../state/runFlow';
import { HomeScreenHint, useOfferHomeScreen } from './HomeScreenHint';
import { GearIcon, PlayIcon, PuzzlePieceIcon, RestartIcon } from './icons';
import { MenuTitle } from './MenuTitle';
import { SecretLongPress, SecretTap } from './debug';
import { useAppStore, useAppStoreApi } from './StoreContext';

export function MainMenu() {
  const store = useAppStoreApi();
  const tileColors = useAppStore((state) => state.data.presentation.tileColors);
  const screens = useAppStore((state) => state.data.presentation.screens);
  const resumable = useAppStore(canContinue);
  const offerHomeScreen = useOfferHomeScreen();

  return (
    <div
      className={offerHomeScreen ? 'screen menu-screen screen-with-hint' : 'screen menu-screen'}
      data-testid="main-menu"
      style={{ '--pop-in-ms': `${screens.popInMs}ms` } as CSSProperties}
    >
      <SecretTap testId="menu-title">
        <MenuTitle
          tileColors={tileColors}
          timings={{
            titleVsSlamMs: screens.titleVsSlamMs,
            titlePlopMs: screens.titlePlopMs,
            titlePlopDelayMs: screens.titlePlopDelayMs,
            titleLetterStaggerMs: screens.titleLetterStaggerMs,
            titleReplayMs: screens.titleReplayMs,
          }}
        />
      </SecretTap>
      <div className="menu-buttons">
        {resumable ? (
          <button
            type="button"
            className="big-button pop-in"
            data-testid="menu-continue"
            aria-label="Continue"
            onClick={() => {
              playUiTap();
              continueRun(store);
            }}
          >
            <PlayIcon size={96} />
            <span className="button-label">Continue</span>
          </button>
        ) : (
          <button
            type="button"
            className="big-button pop-in"
            data-testid="menu-new-run"
            aria-label="New Game"
            onClick={() => {
              playUiTap();
              store.getState().setScreen('difficulty');
            }}
          >
            <PlayIcon size={96} />
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
              onClick={() => {
                playUiTap();
                store.getState().setScreen('difficulty');
              }}
            >
              <RestartIcon size={56} />
              <span className="button-label button-label-small">New Game</span>
            </button>
          )}
          <button
            type="button"
            className="small-button pop-in"
            data-testid="menu-puzzles"
            aria-label="Puzzles"
            onClick={() => {
              playUiTap();
              openPuzzleBook(store);
            }}
          >
            <PuzzlePieceIcon size={56} />
            <span className="button-label button-label-small">Puzzles</span>
          </button>
          <SecretLongPress>
            <button
              type="button"
              className="small-button pop-in"
              data-testid="menu-settings"
              aria-label="Settings"
              onClick={() => {
                playUiTap();
                store.getState().setScreen('settings');
              }}
            >
              <GearIcon size={56} />
              <span className="button-label button-label-small">Settings</span>
            </button>
          </SecretLongPress>
        </div>
      </div>
      {offerHomeScreen && <HomeScreenHint />}
    </div>
  );
}
