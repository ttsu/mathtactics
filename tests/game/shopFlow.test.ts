// Task 19: shopFlow guards — against the real store and the real `applyCommand`.

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../sim/commands';
import type { RunState, ShopOffer } from '../../sim/core/types';
import { buyOffer, leaveShopToNextWave, openShopScreen, shopOffers } from '../../game/state/shopFlow';
import { createAppStore, IDLE_PLAYBACK, NO_SHOP_NEW } from '../../game/state/store';
import { loadSeen, type StorageLike } from '../../game/state/storage';
import { realData } from './boardFixtures';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

function createStore() {
  return createAppStore({
    data: realData,
    applyCommand,
    storage: createMemoryStorage(),
    basePath: '/',
  });
}

const OFFERS: ShopOffer[] = [
  { slot: 'tile:0', kind: 'tile', tileId: 'add:5', price: 4, bought: false },
  { slot: 'cannon', kind: 'cannon', price: 10, bought: false, available: true },
  { slot: 'upgrade', kind: 'upgrade', price: 12, bought: false, fromValue: 1, toValue: 2 },
];

describe('shopOffers', () => {
  it('returns the same empty array when there is no shop', () => {
    expect(shopOffers(null)).toBe(shopOffers({ shop: null } as RunState));
    expect(shopOffers(null)).toEqual([]);
  });

  it('returns the run’s offers', () => {
    const run = { shop: { afterWave: 1, offers: OFFERS } } as RunState;
    expect(shopOffers(run)).toBe(OFFERS);
  });
});

describe('shopFlow guards', () => {
  it('buyOffer is a no-op outside phase shop', () => {
    const store = createStore();
    buyOffer(store, 'tile:0');
    expect(store.getState().run).toBeNull();
  });

  it('leaveShopToNextWave is a no-op outside phase shop', () => {
    const store = createStore();
    leaveShopToNextWave(store);
    expect(store.getState().run).toBeNull();
  });

  it('openShopScreen is a no-op outside waveCleared', () => {
    const store = createStore();
    store.getState().dispatch({ type: 'newRun', seed: 'shop-flow' });
    store.getState().finishPlayback();
    openShopScreen(store);
    expect(store.getState().run?.phase).toBe('planning');
    expect(store.getState().screen).toBe('menu');
  });

  it('leaveShopToNextWave starts the next wave and returns to the game screen', () => {
    const store = createStore();
    store.getState().dispatch({ type: 'newRun', seed: 'leave-shop' });
    store.getState().finishPlayback();
    const started = store.getState().run!;
    const shopRun: RunState = {
      ...started,
      phase: 'shop',
      shop: { afterWave: 1, offers: OFFERS },
      board: { ...started.board, robots: [] },
      pendingSpawns: [],
    };
    store.setState({
      run: shopRun,
      display: { coins: shopRun.coins, baseHp: shopRun.baseHp, waveIndex: 0 },
      playback: { ...IDLE_PLAYBACK },
      screen: 'shop',
    });

    leaveShopToNextWave(store);
    expect(store.getState().run?.phase).toBe('planning');
    expect(store.getState().run?.waveIndex).toBe(1);
    expect(store.getState().run?.shop).toBeNull();
    expect(store.getState().screen).toBe('game');
  });

  it('a double tap on Next wave cannot start two waves', () => {
    const store = createStore();
    store.getState().dispatch({ type: 'newRun', seed: 'double-leave' });
    store.getState().finishPlayback();
    const started = store.getState().run!;
    store.setState({
      run: {
        ...started,
        phase: 'shop',
        shop: { afterWave: 1, offers: OFFERS },
        board: { ...started.board, robots: [] },
        pendingSpawns: [],
      },
      playback: { ...IDLE_PLAYBACK },
      screen: 'shop',
    });

    leaveShopToNextWave(store);
    leaveShopToNextWave(store);
    expect(store.getState().run?.waveIndex).toBe(1);
  });
});

describe('shopNew and buyOffer result', () => {
  it('openShopScreen snapshots unseen tile ids into shopNew and writes the seen log', () => {
    const storage = createMemoryStorage();
    const store = createAppStore({
      data: realData,
      applyCommand,
      storage,
      basePath: '/',
    });
    store.getState().dispatch({ type: 'newRun', seed: 'seen-log' });
    store.getState().finishPlayback();
    const started = store.getState().run!;
    store.setState({
      run: {
        ...started,
        phase: 'waveCleared',
        board: { ...started.board, robots: [] },
        pendingSpawns: [],
      },
      playback: { ...IDLE_PLAYBACK },
    });

    openShopScreen(store);
    const tileIds = shopOffers(store.getState().run)
      .filter((offer): offer is Extract<ShopOffer, { kind: 'tile' }> => offer.kind === 'tile')
      .map((offer) => offer.tileId);
    const unique = [...new Set(tileIds)];
    expect(store.getState().shopNew).toEqual(unique);
    expect(loadSeen(storage, '/')).toEqual([...unique].sort());
    expect(store.getState().screen).toBe('shop');
  });

  it('a type already in loadSeen is not in shopNew', () => {
    const storage = createMemoryStorage();
    storage.setItem('mt:/:seen', JSON.stringify(['add:5']));
    const store = createAppStore({
      data: realData,
      applyCommand,
      storage,
      basePath: '/',
    });
    store.getState().dispatch({ type: 'newRun', seed: 'seen-already' });
    store.getState().finishPlayback();
    const started = store.getState().run!;
    store.setState({
      run: {
        ...started,
        phase: 'waveCleared',
        board: { ...started.board, robots: [] },
        pendingSpawns: [],
      },
      playback: { ...IDLE_PLAYBACK },
    });
    openShopScreen(store);
    expect(store.getState().shopNew).not.toContain('add:5');
  });

  it('leaveShopToNextWave clears shopNew to the stable empty array', () => {
    const store = createStore();
    store.getState().dispatch({ type: 'newRun', seed: 'clear-new' });
    store.getState().finishPlayback();
    const started = store.getState().run!;
    store.setState({
      run: {
        ...started,
        phase: 'shop',
        shop: { afterWave: 1, offers: OFFERS },
        board: { ...started.board, robots: [] },
        pendingSpawns: [],
      },
      playback: { ...IDLE_PLAYBACK },
      screen: 'shop',
      shopNew: ['add:5'],
    });
    leaveShopToNextWave(store);
    expect(store.getState().shopNew).toBe(NO_SHOP_NEW);
    expect(store.getState().shopNew).toEqual([]);
  });

  it('buyOffer returns insufficient_coins without changing the run', () => {
    const store = createStore();
    store.getState().dispatch({ type: 'newRun', seed: 'no-coins' });
    store.getState().finishPlayback();
    const started = store.getState().run!;
    const shopRun: RunState = {
      ...started,
      coins: 0,
      phase: 'shop',
      shop: { afterWave: 1, offers: OFFERS },
      board: { ...started.board, robots: [] },
      pendingSpawns: [],
    };
    store.setState({
      run: shopRun,
      display: { coins: 0, baseHp: shopRun.baseHp, waveIndex: 0 },
      playback: { ...IDLE_PLAYBACK },
      screen: 'shop',
    });
    const result = buyOffer(store, 'tile:0');
    expect(result).toEqual({ ok: false, error: 'insufficient_coins' });
    expect(store.getState().run?.coins).toBe(0);
    expect(store.getState().run?.shop?.offers[0]?.bought).toBe(false);
  });
});
