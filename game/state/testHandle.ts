// Browser test handle (TR §14, GDD §15.2). Installed on `window.__GAME__` only in dev and
// preview builds — never production (CLAUDE.md rule 7) — via a guarded dynamic `import()` at
// the edge (game/main.tsx) so this module is tree-shaken out of a plain `npm run build`.
//
// Methods that depend on later tasks throw a clearly-labelled "not implemented yet" error
// rather than silently doing nothing, so a Playwright test calling one too early fails loudly.

import type { StoreApi } from 'zustand/vanilla';
import type { Cell } from '../../sim/core/coords';
import type { Command, CommandError, GameEvent, RunState } from '../../sim/core/types';
import type { AppStore, Display, Screen } from './store';
import { displayFromRun } from './store';

export interface TestHandle {
  getState(): RunState | null;
  getDisplay(): Display;
  getScreen(): Screen;
  /** Events from the last resolved turn. */
  getEvents(): GameEvent[];
  dispatch(cmd: Command): { ok: boolean; error?: CommandError };
  /** Installs `state` directly, bypassing menus/shop. */
  loadState(state: RunState): void;
  loadScenario(yamlText: string): void;
  endTurn(): GameEvent[];
  /** Finishes playback instantly. */
  skipAnimation(): void;
  /** No playback, no tweens pending. */
  isIdle(): boolean;
  cellToClient(cell: Cell): { x: number; y: number };
}

declare global {
  interface Window {
    /** Only ever set in dev/preview builds — see `installTestHandle` below. */
    __GAME__?: TestHandle;
  }
}

function notImplemented(taskNumber: number): never {
  throw new Error(`not implemented yet (task ${taskNumber})`);
}

/** Builds the `__GAME__` object for `store` — pure, no `window` access, so it's unit-testable. */
export function createTestHandle(store: StoreApi<AppStore>): TestHandle {
  return {
    getState: () => store.getState().run,
    getDisplay: () => store.getState().display,
    getScreen: () => store.getState().screen,
    getEvents: () => store.getState().run?.lastTurnEvents ?? [],
    dispatch: (cmd) => store.getState().dispatch(cmd),
    loadState: (state) => {
      store.setState({ run: state, display: displayFromRun(state) });
    },
    loadScenario: () => notImplemented(8),
    endTurn: () => notImplemented(7),
    skipAnimation: () => notImplemented(10),
    isIdle: () => store.getState().playback.status === 'idle',
    cellToClient: () => notImplemented(9),
  };
}

/** Installs the handle on `window.__GAME__`. Only ever called from the guarded dynamic import
 * in game/main.tsx (TR §14) — never reachable from a production build. */
export function installTestHandle(store: StoreApi<AppStore>): void {
  window.__GAME__ = createTestHandle(store);
}
