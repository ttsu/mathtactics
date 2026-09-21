// Task 34: a one-line "add me to the Home Screen" hint, shown on the main menu only.
//
// Installed to the Home Screen the game runs full screen with no Safari chrome, which is how it
// is meant to be played on an iPad. Only an adult can do the installing, so the wording is plain
// instruction rather than the icon-led style the rest of the menu uses for a pre-reader.
//
// Menu-only on purpose: rendered inside `#ui-root` (not portalled to `<body>` like
// `UpdateBanner`), so it scales with the menu in design space and can never sit over the board.
import type { CSSProperties } from 'react';
import { playUiTap } from '../state/audio';
import { MIN_TOUCH_TARGET } from '../state/designSpace';
import { isIOS, isStandalone, shouldOfferHomeScreen } from '../state/platform';
import { ShareIcon } from './icons';
import { useAppStore, useAppStoreApi } from './StoreContext';

/** Whether the menu should offer the hint. Read by `MainMenu`, which both renders the hint and
 * reserves the room for it — the hint is absolutely positioned, so nothing else would. */
export function useOfferHomeScreen(): boolean {
  const dismissed = useAppStore((state) => state.homeScreenDismissed);
  return shouldOfferHomeScreen({ ios: isIOS(), standalone: isStandalone(), dismissed });
}

export function HomeScreenHint() {
  const store = useAppStoreApi();
  const shimmerMs = useAppStore((state) => state.data.presentation.screens.homeScreenShimmerMs);

  return (
    <div
      className="home-screen-hint"
      data-testid="home-screen-hint"
      role="note"
      style={{ '--home-screen-shimmer-ms': `${shimmerMs}ms` } as CSSProperties}
    >
      <ShareIcon size={28} />
      <span className="home-screen-hint-text">
        Tap Share, then <strong>Add to Home Screen</strong>
      </span>
      <button
        type="button"
        className="home-screen-hint-dismiss"
        data-testid="home-screen-hint-dismiss"
        aria-label="Dismiss"
        style={{ minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET }}
        onClick={() => {
          playUiTap();
          store.getState().dismissHomeScreenHint();
        }}
      >
        ×
      </button>
    </div>
  );
}
