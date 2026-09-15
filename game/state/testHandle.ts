// Browser test handle (TR §14, GDD §15.2). Installed on `window.__GAME__` only in dev and
// preview builds — never production (TR §14 / GDD §15.2) — via a guarded dynamic `import()` at
// the edge (game/main.tsx) so this module is tree-shaken out of a plain `npm run build`.
//
// Methods that depend on later tasks throw a clearly-labelled "not implemented yet" error
// rather than silently doing nothing, so a Playwright test calling one too early fails loudly.

import type { StoreApi } from 'zustand/vanilla';
import type { Cell } from '../../sim/core/coords';
import type { Command, CommandError, GameEvent, RunState } from '../../sim/core/types';
import { buildScenarioState, parseScenario } from '../../sim/scenario';
import type { AppStore, Display, Screen } from './store';
import { displayFromRun, IDLE_PLAYBACK } from './store';

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

/** Installs `state` directly, bypassing `dispatch`/playback entirely — shared by `loadState` and
 * `loadScenario`. Resets any in-flight playback too, otherwise `isIdle()` would stay false after
 * a fresh install (finding 8, final review). */
function installState(store: StoreApi<AppStore>, state: RunState): void {
  store.setState({
    run: state,
    display: displayFromRun(state),
    playback: { ...IDLE_PLAYBACK },
  });
}

/** What the mounted board contributes to the handle. Injected from the edge (game/main.tsx),
 * since /game/state may not import /game/board (TR §2). */
export interface TestHandleBoard {
  cellToClient(cell: Cell): { x: number; y: number };
}

/** Builds the `__GAME__` object for `store` — pure, no `window` access, so it's unit-testable.
 * Without a `board` (unit tests), board-dependent methods throw. */
export function createTestHandle(store: StoreApi<AppStore>, board?: TestHandleBoard): TestHandle {
  return {
    getState: () => store.getState().run,
    getDisplay: () => store.getState().display,
    getScreen: () => store.getState().screen,
    getEvents: () => store.getState().run?.lastTurnEvents ?? [],
    dispatch: (cmd) => store.getState().dispatch(cmd),
    loadState: (state) => installState(store, state),
    loadScenario: (yamlText) => {
      const scenario = parseScenario(yamlText);
      const state = buildScenarioState(scenario, store.getState().data);
      installState(store, state);
    },
    endTurn: () => {
      const result = store.getState().dispatch({ type: 'endTurn' });
      if (!result.ok) return [];
      return store.getState().run?.lastTurnEvents ?? [];
    },
    skipAnimation: () => notImplemented(10),
    isIdle: () => store.getState().playback.status === 'idle',
    cellToClient: (cell) => {
      if (!board) throw new Error('cellToClient: no board mounted');
      return board.cellToClient(cell);
    },
  };
}

/** Installs the handle on `window.__GAME__`. Only ever called from the guarded dynamic import
 * in game/main.tsx (TR §14) — never reachable from a production build. */
export function installTestHandle(store: StoreApi<AppStore>, board?: TestHandleBoard): void {
  window.__GAME__ = createTestHandle(store, board);
}
