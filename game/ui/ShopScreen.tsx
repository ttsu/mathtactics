// Placeholder shop screen (task 19): wallet, plain-text offer rows with a buy button each, and
// ▶ *Next wave*. Task 20 replaces the visuals wholesale — this exists so clearing a wave never
// lands in phase `shop` with nothing rendered. No NEW stickers (`shopNew` / `addSeenMany`).
import type { CSSProperties } from 'react';
import type { ShopOffer } from '../../sim/core/types';
import { buyOffer, leaveShopToNextWave, shopOffers } from '../state/shopFlow';
import { PlayIcon } from './icons';
import { useAppStore, useAppStoreApi } from './StoreContext';

function offerLabel(offer: ShopOffer): string {
  if (offer.kind === 'tile') return `${offer.tileId}  ${offer.price}`;
  if (offer.kind === 'cannon') {
    return offer.available ? `cannon  ${offer.price}` : `cannon  (full)  ${offer.price}`;
  }
  return `${offer.fromValue} → ${offer.toValue}  ${offer.price}`;
}

export function ShopScreen() {
  const store = useAppStoreApi();
  const coins = useAppStore((state) => state.display.coins);
  const offers = useAppStore((state) => shopOffers(state.run));
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);

  return (
    <div
      className="screen shop-screen"
      data-testid="shop"
      style={{ '--pop-in-ms': `${popInMs}ms` } as CSSProperties}
    >
      <div className="hud-stat" data-testid="shop-wallet">
        🪙 {coins}
      </div>
      <ul className="shop-offers">
        {offers.map((offer) => (
          <li key={offer.slot} className="shop-offer-row">
            <span>{offerLabel(offer)}</span>
            <button
              type="button"
              data-testid={`shop-offer-${offer.slot}`}
              disabled={offer.bought || (offer.kind === 'cannon' && !offer.available)}
              onClick={() => buyOffer(store, offer.slot)}
            >
              {offer.bought ? 'bought' : 'buy'}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="big-button pop-in"
        data-testid="shop-next"
        aria-label="Next wave"
        onClick={() => leaveShopToNextWave(store)}
      >
        <PlayIcon size={96} />
        <span className="button-label">Next wave</span>
      </button>
    </div>
  );
}
