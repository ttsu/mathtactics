// Pure shop-card status (task 20). Derived from a `ShopOffer` plus the wallet — no React —
// so affordable / unaffordable / bought / unavailable is unit-testable on its own.

import type { ShopOffer } from '../../sim/core/types';

export type ShopCardStatus = 'affordable' | 'unaffordable' | 'bought' | 'unavailable';

/** One card's interaction state. Bought and unavailable are inert; unaffordable stays tappable. */
export function shopCardStatus(offer: ShopOffer, coins: number): ShopCardStatus {
  if (offer.kind === 'cannon' && !offer.available) return 'unavailable';
  if (offer.bought) return 'bought';
  if (coins < offer.price) return 'unaffordable';
  return 'affordable';
}
