// The M3 shop flow (task 19): opening the shop from the wave-cleared overlay, buying an offer,
// and leaving into the next wave. Framework-free, mirroring `waveFlow.ts`. Every entry point
// guards on phase so a double tap cannot open two shops or start two waves — the UI never
// relies on `wrong_phase` for its own state (the task 16 rule).

import type { StoreApi } from 'zustand/vanilla';
import type { RunState, ShopOffer, ShopSlotId } from '../../sim/core/types';
import type { AppStore } from './store';

/** A single stable empty-array reference for `shopOffers`' "no shop" case. Reusing `useAppStore`
 * as a Zustand selector requires a referentially stable result when nothing has changed — a
 * fresh `[]` literal on every call loops React forever (task 16's `NO_REWARDS` lesson). */
const NO_OFFERS: ShopOffer[] = [];

export function shopOffers(state: RunState | null): ShopOffer[] {
  return state?.shop?.offers ?? NO_OFFERS;
}

/** Wave-cleared overlay ▶: rolls this visit's offers and shows the shop screen. */
export function openShopScreen(store: StoreApi<AppStore>): void {
  const { run } = store.getState();
  if (run === null || run.phase !== 'waveCleared') return;
  store.getState().dispatch({ type: 'openShop' });
  store.getState().setScreen('shop');
}

/** Buy one shop slot. Ignored outside phase `shop`. */
export function buyOffer(store: StoreApi<AppStore>, slot: ShopSlotId): void {
  const { run } = store.getState();
  if (run === null || run.phase !== 'shop') return;
  store.getState().dispatch({ type: 'buyOffer', slot });
}

/** Shop ▶ *Next wave*: starts the next wave and returns to the board. */
export function leaveShopToNextWave(store: StoreApi<AppStore>): void {
  const { run } = store.getState();
  if (run === null || run.phase !== 'shop') return;
  store.getState().dispatch({ type: 'nextWave' });
  store.getState().setScreen('game');
}
