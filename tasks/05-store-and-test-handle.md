# 05 — Store, Persistence Scoping & Test Handle

**Milestone:** M0 · **Layer:** state · **Depends on:** 03, 04 · **Branch:** `task/05-store-and-test-handle`

## Task

Create the framework-free app store bridging sim and renderers, path-scoped storage helpers, and
the `window.__GAME__` test handle (enabled in dev and preview builds only), wired to the app shell.

## References

- GDD §10.4, §15.2, §15.3 · TR §10, §13, §14

## Requirements

1. `/game/state/store.ts`: `zustand/vanilla` store with `AppState` + `AppActions` from TR §10.
   `dispatch` calls a `applyCommand` function — until task 06 exists, inject a stub that returns
   `{ ok: false, error: 'wrong_phase' }`. Structure it so 06/07 plug in without store changes
   (e.g. store receives `applyCommand` via a factory `createAppStore({ data, applyCommand, storage })`).
2. React binding: `useAppStore(selector)` hook in `/game/ui`. Phaser binding: a small `bindStore(scene, store)`
   helper in `/game/board` that subscribes and unsubscribes on scene shutdown.
3. `/game/state/storage.ts`: `scopedKey(key)` per TR §13 (`mt:<basePath>:<key>`); `saveRun`, `loadRun`
   (discard on schema mismatch), `loadSeen`/`addSeen`, `loadSettings`/`saveSettings`; all try/catch-guarded.
   Inject a `Storage`-like interface so it is unit-testable in node.
4. Persist after every successful `dispatch` (TR §13).
5. `/game/state/testHandle.ts` implementing TR §14. Methods that depend on later tasks
   (`endTurn`, `loadScenario`, `skipAnimation`, `cellToClient`) exist and throw `not implemented yet (task NN)`.
   Enabled only when `import.meta.env.DEV || import.meta.env.VITE_TEST_HANDLE === '1'`, via guarded dynamic import.
6. HUD placeholder from task 03 reads coins/base HP from `display` via the store.
7. Tests (vitest, node): `scopedKey` for `/` and `/pr/pr-12/`; save/load round-trip; schema-mismatch discard;
   storage throwing doesn't throw out of helpers; `dispatch` persists on success and not on failure.
8. e2e: `window.__GAME__` exists in the preview build; `getDisplay()` returns base HP 100.

## Out of Scope

Real commands/resolution (06, 07), playback (10).

## Acceptance Criteria

- [x] Keys for production and a PR preview never collide (unit test)
- [x] Mismatched `schemaVersion` save is discarded silently (unit test)
- [x] `__GAME__` present in `VITE_TEST_HANDLE=1` build, absent from production `dist` (grep check)
- [x] No `phaser` or `react` import in `/game/state` (lint)
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

**Status:** Complete
**Completed:** 2026-09-14
**PR:** #5 · Preview: https://mathtactics.timtsu.com/pr/pr-5/ (removed on merge)

**Acceptance criteria:**

- [x] Keys for production and a PR preview never collide (unit test) — Met: `tests/game/storage.test.ts` (`scopedKey` for `/`, `/pr/pr-12/`, non-collision between two different PR previews, and a `saveRun`-under-one-`basePath`-invisible-under-another round-trip check).
- [x] Mismatched `schemaVersion` save is discarded silently (unit test) — Met: `loadRun` returns `null` (not throw) when the saved payload's `schemaVersion` doesn't match the caller-supplied expected version; also covered for corrupt JSON and a missing key.
- [x] `__GAME__` present in `VITE_TEST_HANDLE=1` build, absent from production `dist` (grep check) — Met: `npm run check:no-test-handle` passes on a plain `npm run build`; manually verified a `VITE_TEST_HANDLE=1` build emits a separate `testHandle-*.js` chunk containing the string, while a plain build has no such chunk at all (the guarded dynamic `import()` is fully tree-shaken, not just its callsite). `e2e/test-handle.spec.ts` additionally exercises the real `window.__GAME__` object end-to-end.
- [x] No `phaser` or `react` import in `/game/state` (lint) — Met: pre-existing `eslint.config.js` rule; verified live with real temporary files (`phaser` and `react` imports each triggered `no-restricted-imports`, then removed) and added permanent regression tests to `tests/lint/layer-rules.test.ts`.
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass — Met (see Verification).

**Verification:**

- `npm test` — 14 files, 107 tests passed. 57 tests / 9 files were pre-existing (task 04 baseline); 50 tests are new this task: 17 `storage.test.ts`, 13 `store.test.ts`, 13 `testHandle.test.ts`, 4 `bindStore.test.ts`, 1 `gameData.test.ts` (5 new files), plus 2 new cases added to the pre-existing `layer-rules.test.ts`.
- `npm run typecheck` — `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.sim.json --noEmit`, both clean
- `npm run lint` — `eslint .`, 0 errors/warnings; independently re-verified the `/game/state` phaser/react ban fires on real temporary files, then removed them
- `npm run build` — succeeds (pre-existing Phaser chunk-size warning only); `npm run check:no-test-handle` — OK, no `__GAME__` in `dist`
- `VITE_TEST_HANDLE=1 npx vite build` — emits `dist/assets/testHandle-*.js` containing `__GAME__`; a plain `npm run build` emits no such chunk at all (confirms the guard is eliminated, not merely unreachable at runtime)
- `npx playwright install webkit && npm run test:e2e` — 12 passed (8 `app-shell.spec.ts`, 2 `subpath.spec.ts`, 1 `smoke.spec.ts`, 1 new `test-handle.spec.ts`)
- `npx prettier --check` on all new/changed files — clean after one `--write` pass

**Deviations from spec:**

- **Initial `screen`** is `'game'` (task decision left this open): the task 03 shell already shows the board directly with no menu/screen-flow UI built yet, so `'game'` is the simplest value consistent with what's on screen. Revisit once a real menu/screen flow exists.
- **`applyCommand` fails cleanly when `run` is null** _(superseded — see correction below)_: `dispatch` checked `state.run` before calling `applyCommand` and returned `{ ok: false, error: 'wrong_phase' }` directly, never calling `applyCommand` with a null state, per the task's own decision list.
  **Correction (final M0 whole-branch review, finding 1):** that design made `newRun`/`loadLevel` — the only commands that create a run in the first place — permanently unreachable, since `run` is null on every fresh boot and `dispatch` never let them run. Fixed in the M0 final-review fix pass: `ApplyCommandFn`'s `state` parameter is now typed `RunState | null` (TR §5 updated to match: "`state` is `null` before any run exists; only `newRun` and `loadLevel` accept `null`, others return `wrong_phase`"), and `dispatch` always calls `applyCommand(state.run, cmd, state.data)` — including when `state.run` is null — so a real `applyCommand` (task 06) can bootstrap a run from `null`. `stubApplyCommand` is unaffected (it ignores its argument and always returns `wrong_phase`).
- **`commitEvent`/`finishPlayback` interpretation**: `commitEvent` updates `display.coins` on `CoinsChanged` (to `event.total`, not `delta`) and `display.baseHp` on `BaseDamaged` (to `event.hpAfter`); every other event type is a no-op on `display` (nothing else in `AppState.display` — `{coins, baseHp, waveIndex}` — is affected by any other event today). `finishPlayback` sets `display := displayFromRun(run)` (or leaves `display` unchanged if `run` is somehow still null) and resets `playback` to idle. Both are minimal, literal readings of TR §10's flow description; task 07/10 may need to extend `commitEvent` for `WaveCleared`/`waveIndex` once wave-clear events actually carry that data through `resolveTurn`.
- **`saveRun`'s `savedAt`**: `Date.now` is only banned in `/sim` (CLAUDE.md rule 1); `createAppStore` takes an optional `now?: () => number` (defaulting to `Date.now`) so store tests stay deterministic without needing to fake global time.
- **`setSettings` also persists** (calls `saveSettings` before updating state) even though the task's requirement list only calls out persisting `run` after `dispatch`. Since `storage.ts`'s `loadSettings`/`saveSettings` otherwise had no real caller in this task, wiring `setSettings` to persist was the minimal way to make them load-bearing rather than dead code reachable only from tests. No UI dispatches `setSettings` yet (no settings screen exists), so this has no visible effect until later tasks.
- **Default settings** are `{ hints: false, sound: true }` per GDD §11.8 ("hints off by default"); `sound: true` was not specified by the GDD and was chosen as the conventional default for an unmuted game, not a data-file value (it's a UI preference default, not gameplay tuning under CLAUDE.md rule 3 — kept as a code constant `DEFAULT_SETTINGS` in `storage.ts` rather than `/data`).
- **`bindStore` does not import `phaser`**: `import Phaser from 'phaser'` crashes when evaluated under vitest's `node` environment (`ReferenceError: window is not defined`, confirmed directly), which would make `bindStore` untestable in node. `/game/board/bindStore.ts` instead inlines the Scene Systems Shutdown event name as `SCENE_SHUTDOWN_EVENT = 'shutdown'`, sourced from `node_modules/phaser/src/scene/events/SHUTDOWN_EVENT.js` (`module.exports = 'shutdown'`) and cross-checked against the public `Phaser.Scenes.Events.SHUTDOWN` type. A regression test reads that same installed-package source file and asserts the constant still matches, so a future Phaser upgrade that renames the event fails loudly instead of silently.
- **`bindStore` is not yet called from `BoardLayoutScene`**: the helper is implemented, exported, and unit-tested (fake scene + fake store), but nothing in `/game/board` invokes it yet — board rendering driven by `run`/`display` is task 09's scope (listed in this task's Out of Scope note alongside 06/07/10), and there is nothing for the board to react to yet (no commands succeed until task 06). Wiring it into `BoardLayoutScene` now would be a no-op listener with no purpose.

**Architectural decisions made:**

- `createAppStore({ data, applyCommand, storage, basePath, now? })`: `storage`/`basePath` are separate options (a `StorageLike` + string) rather than one pre-bound object, so the same `storage.ts` free functions used directly in their own unit tests are reused unchanged inside the store, and store tests can swap in a plain in-memory `StorageLike` without also faking a "bound storage port" shape.
- `AppStorage`/persistence port: rather than inventing a new abstraction, `store.ts` calls `storage.ts`'s `saveRun`/`loadRun`/`loadSettings`/`saveSettings` directly — one less layer, and `storage.ts` was already designed (per the task's own decisions) to take `(storage, basePath, ...)` as plain parameters.
- `game/state/gameData.ts`: a small dedicated module that imports all seven `/data/*.json` files via Vite and calls `parseGameData` once at module load, exporting the validated `gameData: GameData`. Framework-free (`/game/state`), so it's usable from `game/main.tsx` (the edge) and directly unit-tested (`tests/game/gameData.test.ts`) without a browser — Vite/vitest both support JSON imports natively.
- `game/ui/StoreContext.tsx`: a React Context provides the store instance (`StoreProvider`) and `useAppStore(selector)` reads it via zustand's `useStore` — chosen over a props-drilling approach since `App`/`Hud` shouldn't need to know how the store reaches them, and it matches the task's own suggested option ("context or props from main.tsx").
- `window.__GAME__` typing: `testHandle.ts` declares a global `Window.__GAME__?: TestHandle` augmentation (rather than casting at every call site) so both `installTestHandle` and `e2e/test-handle.spec.ts`'s `page.evaluate` callbacks get real types; `page.evaluate`'s own separate browser-context type checking still needs a `!` per access since TS can't narrow across separate `evaluate` closures.
- `check:no-test-handle` (task 02) needed no changes — it already scans arbitrary build output for the literal string, and the dynamic-import guard proved to fully tree-shake the handle module (verified: zero occurrences, and no `testHandle-*.js` chunk at all in a plain build), not just make it unreachable at runtime.

**Design questions raised:**

- None. Every open call (initial `screen`, `commitEvent`/`finishPlayback` semantics, `sound` default) was explicitly flagged as a task decision left for this session to make and record, per the task's own "Decisions already made" list.

**Known issues / follow-up:**

- `bindStore` is unused in production code today (see Deviations) — task 09 is expected to be its first real caller, subscribing `BoardLayoutScene` (or its successor) to `run`/`display` changes.
- `commitEvent` only handles `CoinsChanged`/`BaseDamaged` — revisit once task 07's real event list is flowing through playback and task 10's Director needs more HUD-relevant events committed (e.g. `WaveCleared` → `display.waveIndex`).
- The Phaser bundle-size warning (~1.6 MB / ~455 KB gzip) is unchanged from earlier tasks; still out of scope here.

**Files created:** `game/state/storage.ts`, `game/state/store.ts`, `game/state/testHandle.ts`, `game/state/gameData.ts`, `game/ui/StoreContext.tsx`, `game/board/bindStore.ts`, `tests/game/storage.test.ts`, `tests/game/store.test.ts`, `tests/game/testHandle.test.ts`, `tests/game/bindStore.test.ts`, `tests/game/gameData.test.ts`, `e2e/test-handle.spec.ts`

**Files modified:** `game/main.tsx` (wires `gameData`/`createAppStore`/`StoreProvider`/guarded test-handle import), `game/ui/Hud.tsx` (reads `display` via `useAppStore`), `game/ui/index.ts` (exports `StoreProvider`/`useAppStore`), `game/board/index.ts` (exports `bindStore`), `game/state/index.ts` (real barrel, was task-01 placeholder), `tests/lint/layer-rules.test.ts` (added `/game/state` phaser/react regression cases), `TASKS.md` (status for task 05)

**Notes for next agent:**

- Task 06 (`applyCommand`) plugs in by passing the real function to `createAppStore({ applyCommand: realApplyCommand, ... })` in `game/main.tsx` instead of `stubApplyCommand` — no store changes needed, per this task's design goal.
- `game/state/testHandle.ts`'s `endTurn`/`loadScenario`/`skipAnimation`/`cellToClient` all throw `not implemented yet (task N)` — replace each with a real implementation as its owning task lands (07, 08, 10, 09 respectively), and delete the corresponding `notImplemented(...)` call.
- `AppState.display` today only tracks `{coins, baseHp, waveIndex}`; if a later task's HUD needs more (e.g. a wave-cleared banner), extend `Display` and `commitEvent`/`displayFromRun`/`displayFromEconomy` together — they're the three places that must stay in sync.
- `tests/game/**` run under vitest's `node` environment (no DOM, no `window`) — confirmed the hard way when `import Phaser from 'phaser'` crashed in `bindStore.test.ts`'s first draft; anything under `/game/board` that needs to unit-test against real Phaser constants should inline/verify them the way `bindStore.ts` does (read the installed package's own source in a test) rather than importing the runtime.
