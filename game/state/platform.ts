/** True on iPhone, iPad and iPod touch (including iPadOS desktop-mode Safari). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * True when the page is running as an installed Home Screen app rather than a browser tab.
 * `navigator.standalone` is the iOS Safari signal; the `display-mode` query is the standard one
 * (and what a Chromium-based browser reports), so both are checked.
 */
export function isStandalone(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayMode =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return iosStandalone || displayMode;
}

/**
 * Whether to show the "Share → Add to Home Screen" hint (main menu only). Kept pure — the DOM
 * reads happen at the edge (`isIOS`, `isStandalone`) and the stored dismissal comes from
 * `loadHomeScreenDismissed` — so the rule itself is unit-testable without a DOM.
 *
 * Off iOS on purpose: the wording names iOS's Share sheet, and v1 is an iPad game.
 */
export function shouldOfferHomeScreen(input: {
  ios: boolean;
  standalone: boolean;
  dismissed: boolean;
}): boolean {
  return input.ios && !input.standalone && !input.dismissed;
}
