import { describe, expect, it } from 'vitest';
import { shouldOfferHomeScreen } from '../../game/state/platform';

// `shouldOfferHomeScreen` is the pure half of the Add-to-Home-Screen decision: the DOM reads
// (`isIOS`, `isStandalone`) happen at the edge and the three booleans they produce come in here,
// so the rule itself is testable in vitest's node environment.
describe('shouldOfferHomeScreen', () => {
  it('offers on iOS in a browser tab, not yet dismissed', () => {
    expect(shouldOfferHomeScreen({ ios: true, standalone: false, dismissed: false })).toBe(true);
  });

  it('stays silent once already installed to the Home Screen', () => {
    expect(shouldOfferHomeScreen({ ios: true, standalone: true, dismissed: false })).toBe(false);
  });

  it('stays silent once dismissed', () => {
    expect(shouldOfferHomeScreen({ ios: true, standalone: false, dismissed: true })).toBe(false);
  });

  it('stays silent off iOS — the Share → Add to Home Screen wording would be wrong', () => {
    expect(shouldOfferHomeScreen({ ios: false, standalone: false, dismissed: false })).toBe(false);
  });
});
