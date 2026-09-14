// The framework-free app store bridging /sim and both renderers (TR §10). Built on
// `zustand/vanilla` — React binds via `useStore` (/game/ui/StoreContext.tsx), Phaser via
// `store.subscribe` (/game/board/bindStore.ts). Never imports `phaser` or `react` (TR §2).
//
// `applyCommand` and persistence are injected (`createAppStore({ data, applyCommand, storage,
// basePath })`) so tasks 06/07 (real `applyCommand`) plug in without any store change.

import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Command, CommandError, GameEvent, RunState } from '../../sim/core/types';
import type { GameData } from '../../sim/data/schemas';
import {
  loadRun,
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

export type Screen = 'menu' | 'game' | 'shop' | 'settings' | 'won' | 'lost' | 'levelSelect';

export interface Playback {
  status: 'idle' | 'playing';
  events: GameEvent[];
  cursor: number;
}

export interface AppState {
  data: GameData;
  /** Committed simulation truth (already includes the resolved turn), or `null` before any run
   * exists / is loaded. */
  run: RunState | null;
  /** What the HUD shows; lags `run` during playback (TR §10). */
  display: Display;
  playback: Playback;
  screen: Screen;
  settings: Settings;
}

export interface AppActions {
  dispatch(cmd: Command): { ok: boolean; error?: CommandError };
  /** Playback → display slice only. Never touches `run` (TR §10). */
  commitEvent(event: GameEvent): void;
  /** `display := derived from run`; playback → idle. */
  finishPlayback(): void;
  setSettings(patch: Partial<Settings>): void;
}

export type AppStore = AppState & AppActions;

/** Shared idle-playback value — used for the store's initial state, `finishPlayback`, and (TR
 * §14) `loadState`'s reset, so the three places that need "no playback" agree on its shape. */
export const IDLE_PLAYBACK: Playback = { status: 'idle', events: [], cursor: 0 };

export interface CreateAppStoreOptions {
  data: GameData;
  applyCommand: ApplyCommandFn;
  storage: StorageLike;
  basePath: string;
  /** Clock for `saveRun`'s `savedAt` (CLAUDE.md rule 1 only bans `Date.now` in `/sim`; injected
   * here so store tests stay deterministic). Defaults to `Date.now`. */
  now?: () => number;
}

/** `display` derived from the committed run (TR §10 flow step 4/5). */
export function displayFromRun(run: RunState): Display {
  return { coins: run.coins, baseHp: run.baseHp, waveIndex: run.waveIndex };
}

/** `display` derived from `data.economy` before any run exists (task 05 decision: satisfies the
 * e2e `getDisplay()` base HP check). */
function displayFromEconomy(data: GameData): Display {
  return { coins: data.economy.startCoins, baseHp: data.economy.baseHp, waveIndex: 0 };
}

export function createAppStore(options: CreateAppStoreOptions): StoreApi<AppStore> {
  const { data, applyCommand, storage, basePath } = options;
  const now = options.now ?? Date.now;

  const initialRun = loadRun(storage, basePath, data.economy.schemaVersion);
  const initialSettings = loadSettings(storage, basePath);

  return createStore<AppStore>()((set, get) => ({
    data,
    run: initialRun,
    display: initialRun ? displayFromRun(initialRun) : displayFromEconomy(data),
    playback: { ...IDLE_PLAYBACK },
    // Deviation (task 05): no menu/screen flow exists yet (task 03 shell shows the board
    // directly) — 'game' is the simplest value consistent with what's on screen today.
    screen: 'game',
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

      saveRun(storage, basePath, result.state, now());
      if (result.events.length > 0) {
        set({
          run: result.state,
          playback: { status: 'playing', events: result.events, cursor: 0 },
        });
      } else {
        // No resolution events to play back, so `display` won't be refreshed by `commitEvent`/
        // `finishPlayback` — derive it from `run` directly here (TR §10: `display` lags `run`
        // only *during* playback). Leave it alone if playback is already mid-flight so we don't
        // race ahead of what's still animating.
        set({
          run: result.state,
          display:
            state.playback.status === 'playing' ? state.display : displayFromRun(result.state),
        });
      }
      return { ok: true };
    },

    commitEvent(event) {
      set((state) => {
        switch (event.type) {
          case 'CoinsChanged':
            return { display: { ...state.display, coins: event.total } };
          case 'BaseDamaged':
            return { display: { ...state.display, baseHp: event.hpAfter } };
          default:
            return {};
        }
      });
    },

    finishPlayback() {
      set((state) => ({
        display: state.run ? displayFromRun(state.run) : state.display,
        playback: { ...IDLE_PLAYBACK },
      }));
    },

    setSettings(patch) {
      const next = { ...get().settings, ...patch };
      saveSettings(storage, basePath, next);
      set({ settings: next });
    },
  }));
}
