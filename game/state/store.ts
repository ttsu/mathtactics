// The framework-free app store bridging /sim and both renderers (TR §10). Built on
// `zustand/vanilla` — React binds via `useStore` (/game/ui/StoreContext.tsx), Phaser via
// `store.subscribe` (/game/board/bindStore.ts). Never imports `phaser` or `react` (TR §2).
//
// `applyCommand` and persistence are injected (`createAppStore({ data, applyCommand, storage,
// basePath })`) so tasks 06/07 (real `applyCommand`) plug in without any store change.

import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Command, CommandError, GameEvent, RunState, TileId } from '../../sim/core/types';
import type { GameData } from '../../sim/data/schemas';
import {
  clearRun,
  addSeenMany,
  loadRun,
  loadSeen,
  loadSettings,
  saveRun,
  saveSettings,
  type Settings,
  type StorageLike,
} from './storage';

export type ApplyCommandResult =
  { ok: true; state: RunState; events: GameEvent[] } | { ok: false; error: CommandError };

/** Matches TR §5's `applyCommand(state, cmd, data)` signature. `state` is `null` before any run
 * exists — only `newRun`/`loadLevel` accept that; every other command returns `wrong_phase`. */
export type ApplyCommandFn = (
  state: RunState | null,
  cmd: Command,
  data: GameData,
) => ApplyCommandResult;

/** Until task 06 exists, inject this stub — every command fails with `wrong_phase`. */
export const stubApplyCommand: ApplyCommandFn = () => ({ ok: false, error: 'wrong_phase' });

export interface Display {
  coins: number;
  baseHp: number;
  waveIndex: number;
}

/** `allDone` = every M1 puzzle level cleared (task 11). */
export type Screen =
  'menu' | 'game' | 'shop' | 'settings' | 'won' | 'lost' | 'levelSelect' | 'allDone';

export interface Playback {
  /** `playing` = a just-resolved turn; `replaying` = the Replay button re-showing the last turn
   * (visual only — `commitEvent` ignores its events, task 10 req. 6). */
  status: 'idle' | 'playing' | 'replaying';
  events: GameEvent[];
  cursor: number;
  /** The run the board shows as this sequence starts, before any of `events` is performed — set
   * for every sequence the store starts (`sequenceStart` for a dispatch, `lastTurn.before` for a
   * Replay); absent when idle. The board syncs to it first, so nothing from whatever it showed
   * earlier (a previous run, a puzzle) stays on screen during the sequence. */
  before?: RunState;
}

/** The last resolved turn, with the run as it was just before it — the snapshot Replay plays
 * from (TR §11.4). Kept in memory only: after a reload there is none, so Replay is disabled. */
export interface LastTurn {
  before: RunState;
  events: GameEvent[];
}

export interface AppState {
  data: GameData;
  /** Committed simulation truth (already includes the resolved turn), or `null` before any run
   * exists / is loaded. */
  run: RunState | null;
  /** A memory copy of the `run` storage key — task 14's `runFlow.ts` reads this (not `run`) to
   * decide whether ▶ Continue is offered, so it still reflects the saved run after Puzzles has
   * replaced `run` for the current session. Kept in lock-step with storage: every `dispatch`
   * whose result is `mode: 'run'` updates both together; a level-mode dispatch touches neither
   * (task 14 req. 1). `null` once a run ends (`clearRun`) or on boot for a save already ended. */
  savedRun: RunState | null;
  /** What the HUD shows; lags `run` during playback (TR §10). */
  display: Display;
  playback: Playback;
  lastTurn: LastTurn | null;
  /** Tile types this shop visit offered for the first time on this device (GDD §8.7). Memory-only:
   * a reload inside the shop loses the NEW stickers. Default is `NO_SHOP_NEW`. */
  shopNew: TileId[];
  screen: Screen;
  settings: Settings;
}

export interface AppActions {
  dispatch(cmd: Command): { ok: boolean; error?: CommandError };
  /** Playback → display slice only. Never touches `run` (TR §10). Ignored during a replay. */
  commitEvent(event: GameEvent): void;
  /** `display := derived from run`; playback → idle. */
  finishPlayback(): void;
  /** Starts a visual-only replay of `lastTurn` when `canReplay`; returns whether it started.
   * Dispatches nothing. */
  startReplay(): boolean;
  setSettings(patch: Partial<Settings>): void;
  /** Shows `screen`. Screen changes never touch `run` (task 11: the level flow in `levelFlow.ts`
   * pairs this with `dispatch`). */
  setScreen(screen: Screen): void;
  /** Shop-open seen log (task 20): snapshot ids not already in `loadSeen` into `shopNew`, then
   * write every offered tile type via `addSeenMany`. Storage is closed over here, not on
   * `AppState`. */
  recordShopVisit(tileIds: readonly TileId[]): void;
}

export type AppStore = AppState & AppActions;

/** Shared idle-playback value — used for the store's initial state, `finishPlayback`, and (TR
 * §14) `loadState`'s reset, so the three places that need "no playback" agree on its shape. */
export const IDLE_PLAYBACK: Playback = { status: 'idle', events: [], cursor: 0 };

/** Stable empty `shopNew` for selectors (task 16's `NO_REWARDS` lesson: a fresh `[]` loops React). */
export const NO_SHOP_NEW: TileId[] = [];

/** True while a resolved turn (or a Replay) is playing back — the one gate both renderers use to block
 * planning input (board drags, HUD buttons). */
export function isPlaybackActive(state: Pick<AppState, 'playback'>): boolean {
  return state.playback.status !== 'idle';
}

/** Replay is offered in planning, when idle, and only for a turn whose pre-turn snapshot this
 * session still holds (task 10 req. 6). */
export function canReplay(state: Pick<AppState, 'run' | 'playback' | 'lastTurn'>): boolean {
  const { run, lastTurn } = state;
  return (
    run !== null &&
    run.phase === 'planning' &&
    !isPlaybackActive(state) &&
    run.lastTurnEvents.length > 0 &&
    lastTurn !== null
  );
}

export interface CreateAppStoreOptions {
  data: GameData;
  applyCommand: ApplyCommandFn;
  storage: StorageLike;
  basePath: string;
  /** Clock for `saveRun`'s `savedAt` (CLAUDE.md rule 1 only bans `Date.now` in `/sim`; injected
   * here so store tests stay deterministic). Defaults to `Date.now`. */
  now?: () => number;
}

/** Where the board starts for a dispatch's playback. A normal turn starts from the run as it was
 * (`previous`). A fresh phase (`newRun`/`nextWave`) has no meaningful previous board — `newRun`
 * replaces whatever was shown (a lost run, a puzzle), and its robot ids restart at `robot:0` — so
 * it starts from the new run minus the robots its own spawn events bring in: the empty wave start
 * those events then fill. Derived from event payloads only; no rules are re-run. */
export function sequenceStart(
  previous: RunState | null,
  next: RunState,
  events: readonly GameEvent[],
  freshPhase: boolean,
): RunState | undefined {
  if (!freshPhase) return previous ?? undefined;
  const introduced = new Set(
    events.flatMap((event) =>
      event.type === 'RobotSpawned' || event.type === 'RobotWaiting' ? [event.robotId] : [],
    ),
  );
  return {
    ...next,
    board: {
      ...next.board,
      robots: next.board.robots.filter((robot) => !introduced.has(robot.robotId)),
    },
  };
}

/** `display` derived from the committed run (TR §10 flow step 4/5). `baseHp` may go negative in
 * `run` (TR §6, task 15 req. 3) — the display never shows below 0, so every path that derives
 * `display` straight from `run` (not through a ticked `BaseDamaged` commit) clamps here too:
 * `finishPlayback`, the no-events branch of `dispatch`, initial load, and the test handle's
 * `loadState`/`loadScenario`. */
export function displayFromRun(run: RunState): Display {
  return { coins: run.coins, baseHp: Math.max(0, run.baseHp), waveIndex: run.waveIndex };
}

/** `display` derived from `data.economy` before any run exists (task 05 decision: satisfies the
 * e2e `getDisplay()` base HP check). */
function displayFromEconomy(data: GameData): Display {
  return { coins: data.economy.startCoins, baseHp: data.economy.baseHp, waveIndex: 0 };
}

/** A run that has reached its end screen (GDD §10.1/§10.4): not resumable, and its save is
 * cleared once this is true — on boot for a save found already ended, or when playback finishes
 * on this phase (`finishPlayback` below). Level mode never reaches `won`/`lost` (TR §4.1), but
 * the `mode` check is kept for clarity/defence. */
function isFinishedRun(run: RunState): run is RunState & { phase: 'won' | 'lost' } {
  return run.mode === 'run' && (run.phase === 'won' || run.phase === 'lost');
}

export function createAppStore(options: CreateAppStoreOptions): StoreApi<AppStore> {
  const { data, applyCommand, storage, basePath } = options;
  const now = options.now ?? Date.now;

  let initialRun = loadRun(storage, basePath, data.economy.schemaVersion);
  if (initialRun && isFinishedRun(initialRun)) {
    // Task 14 req. 2: a save found with phase `won`/`lost` on boot is not resumable and is
    // cleared — the same treatment `finishPlayback` gives a run that just finished.
    clearRun(storage, basePath);
    initialRun = null;
  }
  const initialSettings = loadSettings(storage, basePath);

  return createStore<AppStore>()((set, get) => ({
    data,
    run: initialRun,
    savedRun: initialRun,
    display: initialRun ? displayFromRun(initialRun) : displayFromEconomy(data),
    playback: { ...IDLE_PLAYBACK },
    lastTurn: null,
    shopNew: NO_SHOP_NEW,
    // Task 11/14: the app always opens on the main menu, never auto-resuming a saved run.
    screen: 'menu',
    settings: initialSettings,

    dispatch(cmd) {
      const state = get();
      // `state.run` may be null (no run exists yet) — `applyCommand` is always called, even
      // then; only `newRun`/`loadLevel` accept a null state, everything else returns
      // `wrong_phase` itself (TR §5). This is what lets `newRun`/`loadLevel` bootstrap a run.
      const result = applyCommand(state.run, cmd, state.data);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      // Task 14 req. 1: only a `mode: 'run'` result is saved — a level-mode dispatch (Puzzles)
      // never writes (or removes) the `run` key, so it can never overwrite a saved run.
      // `savedRun` is the in-memory mirror of that same key (see its doc comment above).
      const persists = result.state.mode === 'run';
      if (persists) {
        saveRun(storage, basePath, result.state, now());
      }
      const savedRun = persists ? result.state : state.savedRun;

      // `newRun`/`nextWave` start a fresh planning phase; Replay must stay off until the first
      // End Turn of that phase (task 14 req. 2), even though both commands produce resolution
      // events (the wave's turn-1 spawns) that play back like any other turn.
      const freshPhase = cmd.type === 'newRun' || cmd.type === 'nextWave';

      // A shop-phase result never starts playback (task 19): `buyOffer` emits events for tests
      // and scenarios, but there is no board animation for a purchase. `display` still updates
      // from the new run at once, and the lastTurn Replay snapshot is kept.
      if (result.events.length > 0 && result.state.phase !== 'shop') {
        set({
          run: result.state,
          savedRun,
          // A fresh phase's events are spawns only — no HUD event will ever commit its coins or
          // base HP — so `display` jumps to the new state now. Without this, New Run after a lost
          // run (or a puzzle) would keep showing the old ♥/🪙 (♥ 0) until playback ends.
          ...(freshPhase ? { display: displayFromRun(result.state) } : {}),
          playback: {
            status: 'playing',
            events: result.events,
            cursor: 0,
            before: sequenceStart(state.run, result.state, result.events, freshPhase),
          },
          // Replay's snapshot: the board as it was before this turn (task 10 req. 6).
          lastTurn: !freshPhase && state.run ? { before: state.run, events: result.events } : null,
        });
      } else {
        // No resolution events to play back, so `display` won't be refreshed by `commitEvent`/
        // `finishPlayback` — derive it from `run` directly here (TR §10: `display` lags `run`
        // only *during* playback). Leave it alone if playback is already mid-flight so we don't
        // race ahead of what's still animating.
        set({
          run: result.state,
          savedRun,
          display: isPlaybackActive(state) ? state.display : displayFromRun(result.state),
          // A snapshot only belongs to the run whose last turn it recorded — a command that
          // installs a different run (e.g. `loadLevel`) drops it. Planning commands carry
          // `lastTurnEvents` over unchanged, so they keep it.
          lastTurn:
            !freshPhase && state.lastTurn && result.state.lastTurnEvents === state.lastTurn.events
              ? state.lastTurn
              : null,
        });
      }
      return { ok: true };
    },

    commitEvent(event) {
      set((state) => {
        if (state.playback.status === 'replaying') return {};
        switch (event.type) {
          case 'CoinsChanged':
            return { display: { ...state.display, coins: event.total } };
          case 'BaseDamaged':
            // `baseHp` may go negative in `run` (TR §6); the display never shows below 0 (task
            // 15 req. 3) — clamped here, the one place a `BaseDamaged` event reaches `display`,
            // whether committed once or ticked through a count-down.
            return { display: { ...state.display, baseHp: Math.max(0, event.hpAfter) } };
          default:
            return {};
        }
      });
    },

    finishPlayback() {
      set((state) => {
        const { run } = state;
        if (run && isFinishedRun(run)) {
          // Task 14 req. 2: the run's playback (the final detonation/base-damage beats) has now
          // finished on a `won`/`lost` phase — show the matching screen and clear the save. The
          // actual won/lost screens are task 16's; this only switches `screen`.
          clearRun(storage, basePath);
          return {
            display: displayFromRun(run),
            playback: { ...IDLE_PLAYBACK },
            screen: run.phase,
            savedRun: null,
          };
        }
        return {
          display: run ? displayFromRun(run) : state.display,
          playback: { ...IDLE_PLAYBACK },
        };
      });
    },

    startReplay() {
      const state = get();
      if (!canReplay(state) || state.lastTurn === null) return false;
      set({
        playback: {
          status: 'replaying',
          events: state.lastTurn.events,
          cursor: 0,
          before: state.lastTurn.before,
        },
      });
      return true;
    },

    setSettings(patch) {
      const next = { ...get().settings, ...patch };
      saveSettings(storage, basePath, next);
      set({ settings: next });
    },

    setScreen(screen) {
      set({ screen });
    },

    recordShopVisit(tileIds) {
      const seen = new Set(loadSeen(storage, basePath));
      const fresh: TileId[] = [];
      for (const id of tileIds) {
        if (!seen.has(id) && !fresh.includes(id)) fresh.push(id);
      }
      addSeenMany(storage, basePath, tileIds);
      set({ shopNew: fresh.length === 0 ? NO_SHOP_NEW : fresh });
    },
  }));
}
