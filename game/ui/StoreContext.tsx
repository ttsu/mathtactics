// Provides the /game/state store to React without /game/ui importing /game/board (TR §2, task
// 05 decision). `useStore` is zustand's React binding used directly against the vanilla store —
// only `/game/state` is restricted to `zustand/vanilla` (TR §2).
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { AppStore } from '../state/store';

const StoreContext = createContext<StoreApi<AppStore> | null>(null);

export function StoreProvider({
  store,
  children,
}: {
  store: StoreApi<AppStore>;
  children: ReactNode;
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** Reads a slice of the app store, re-rendering when `selector`'s result changes. */
export function useAppStore<T>(selector: (state: AppStore) => T): T {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useAppStore must be used within a <StoreProvider>');
  }
  return useStore(store, selector);
}

/** The store itself, for flow steps that read fresh state and act at click time (e.g.
 * `/game/state/levelFlow.ts`). */
export function useAppStoreApi(): StoreApi<AppStore> {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useAppStoreApi must be used within a <StoreProvider>');
  }
  return store;
}
