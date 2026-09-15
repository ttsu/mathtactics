// Browser test handle (TR §14, GDD §15.2). Installed on `window.__GAME__` only in dev and
// preview builds — never production (TR §14 / GDD §15.2) — via a guarded dynamic `import()` at
// the edge (game/main.tsx) so this module is tree-shaken out of a plain `npm run build`.

import type { StoreApi } from 'zustand/vanilla';
import type { Cell } from '../../sim/core/coords';
import type { Command, CommandError, GameEvent, RunState } from '../../sim/core/types';
import type { GameData } from '../../sim/data/schemas';
import { buildScenarioState, effectiveData, parseScenario } from '../../sim/scenario';
import type { AppStore, Display, Screen } from './store';
import { displayFromRun, IDLE_PLAYBACK, isPlaybackActive } from './store';

export interface TestHandle {
  getState(): RunState | null;
  getDisplay(): Display;
  getScreen(): Screen;
  /** Events from the last resolved turn. */
  getEvents(): GameEvent[];
  dispatch(cmd: Command): { ok: boolean; error?: CommandError };
  /** Installs `state` directly, bypassing menus/shop. */
  loadState(state: RunState): void;
  /** Installs a scenario's initial state. A scenario `waves:` list also replaces the shipped
   * waves for the session (as in the scenario runner) until the next `loadState`/`loadScenario`
   * or a page reload — so e2e wave flows don't depend on ladder tuning. */
  loadScenario(yamlText: string): void;
  endTurn(): GameEvent[];
  /** Finishes playback instantly: every remaining beat's final state and HUD commit applied. */
  skipAnimation(): void;
  /** No playback, and the playback Director has no tweens/timers pending. */
  isIdle(): boolean;
  cellToClient(cell: Cell): { x: number; y: number };
  /** What the board draws right now — robot views with their centres in client coordinates
   * (mid-tween included) and tile views' piece ids — for asserting the board mid-playback. */
  renderedBoard(): RenderedBoard;
}

export interface RenderedBoard {
  robots: { robotId: string; x: number; y: number }[];
  tiles: string[];
}

declare global {
  interface Window {
    /** Only ever set in dev/preview builds — see `installTestHandle` below. */
    __GAME__?: TestHandle;
  }
}

/** Installs `state` directly, bypassing `dispatch`/playback entirely — shared by `loadState` and
 * `loadScenario`. Resets any in-flight playback too, otherwise `isIdle()` would stay false after
 * a fresh install (finding 8, final review). Shows the game screen, bypassing the menu (TR §14,
 * task 11). */
function installState(store: StoreApi<AppStore>, state: RunState, data: GameData): void {
  store.setState({
    data,
    run: state,
    display: displayFromRun(state),
    playback: { ...IDLE_PLAYBACK },
    lastTurn: null,
    screen: 'game',
  });
}

/** What the mounted board contributes to the handle. Injected from the edge (game/main.tsx),
 * since /game/state may not import /game/board (TR §2). */
export interface TestHandleBoard {
  cellToClient(cell: Cell): { x: number; y: number };
  /** Finishes the playback Director's sequence instantly (it then calls `finishPlayback`). */
  skipAnimation(): void;
  /** True while the playback Director has a sequence, tweens or timers pending. */
  isAnimating(): boolean;
  renderedBoard(): RenderedBoard;
}

/** Builds the `__GAME__` object for `store` — pure, no `window` access, so it's unit-testable.
 * Without a `board` (unit tests), `cellToClient` throws, and `skipAnimation`/`isIdle` fall back to
 * the store's playback status alone. */
export function createTestHandle(store: StoreApi<AppStore>, board?: TestHandleBoard): TestHandle {
  // The data the app booted with; a scenario's `waves:` only ever overrides it for its own install.
  const shippedData = store.getState().data;
  return {
    getState: () => store.getState().run,
    getDisplay: () => store.getState().display,
    getScreen: () => store.getState().screen,
    getEvents: () => store.getState().run?.lastTurnEvents ?? [],
    dispatch: (cmd) => store.getState().dispatch(cmd),
    loadState: (state) => installState(store, state, shippedData),
    loadScenario: (yamlText) => {
      const scenario = parseScenario(yamlText);
      const data = effectiveData(scenario, shippedData);
      installState(store, buildScenarioState(scenario, data), data);
    },
    endTurn: () => {
      const result = store.getState().dispatch({ type: 'endTurn' });
      if (!result.ok) return [];
      return store.getState().run?.lastTurnEvents ?? [];
    },
    skipAnimation: () => {
      if (board) board.skipAnimation();
      // Nothing mounted to play it (or the board had no sequence): finish directly.
      if (isPlaybackActive(store.getState())) store.getState().finishPlayback();
    },
    isIdle: () => !isPlaybackActive(store.getState()) && !(board?.isAnimating() ?? false),
    cellToClient: (cell) => {
      if (!board) throw new Error('cellToClient: no board mounted');
      return board.cellToClient(cell);
    },
    renderedBoard: () => {
      if (!board) throw new Error('renderedBoard: no board mounted');
      return board.renderedBoard();
    },
  };
}

/** Installs the handle on `window.__GAME__`. Only ever called from the guarded dynamic import
 * in game/main.tsx (TR §14) — never reachable from a production build. */
export function installTestHandle(store: StoreApi<AppStore>, board?: TestHandleBoard): void {
  window.__GAME__ = createTestHandle(store, board);
}
