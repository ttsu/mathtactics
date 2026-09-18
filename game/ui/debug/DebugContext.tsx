// Debug-menu UI state. Kept out of the app store so opening it never touches `run` or `screen`.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { DebugResult } from '../../state/debug';
import { makeDebugSeed } from '../../state/debug';
import type { AppStore } from '../../state/store';
import { useAppStoreApi } from '../StoreContext';

export interface DebugUi {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  shakeEnabled: boolean;
  setShakeEnabled: (enabled: boolean) => void;
  apply: (result: DebugResult) => string | null;
  seed: () => string;
  store: StoreApi<AppStore>;
}

const DebugUiContext = createContext<DebugUi | null>(null);

export function DebugUiProvider({ children }: { children: ReactNode }) {
  const store = useAppStoreApi();
  const [open, setOpen] = useState(false);
  const [shakeEnabled, setShakeEnabled] = useState(false);

  const toggle = useCallback(() => setOpen((current) => !current), []);
  const apply = useCallback(
    (result: DebugResult) => {
      if (!result.ok) return result.error;
      store.getState().installRun(result.run);
      return null;
    },
    [store],
  );
  const seed = useCallback(() => makeDebugSeed(), []);

  const value = useMemo<DebugUi>(
    () => ({
      open,
      setOpen,
      toggle,
      shakeEnabled,
      setShakeEnabled,
      apply,
      seed,
      store,
    }),
    [open, toggle, shakeEnabled, apply, seed, store],
  );

  return <DebugUiContext.Provider value={value}>{children}</DebugUiContext.Provider>;
}

export function useDebugUi(): DebugUi {
  const value = useContext(DebugUiContext);
  if (!value) throw new Error('useDebugUi must be used within DebugUiProvider');
  return value;
}
