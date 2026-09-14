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

- [ ] Keys for production and a PR preview never collide (unit test)
- [ ] Mismatched `schemaVersion` save is discarded silently (unit test)
- [ ] `__GAME__` present in `VITE_TEST_HANDLE=1` build, absent from production `dist` (grep check)
- [ ] No `phaser` or `react` import in `/game/state` (lint)
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

**Status:** Not Started
