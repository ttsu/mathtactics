# 32 — Puzzle Book

**Milestone:** M5 · **Layer:** data / sim / state / ui · **Depends on:** 31 · **Branch:** `cursor/puzzle-book-94fa`

## Task

Turn Puzzles into a selectable book of authored scenarios: a 50-entry catalog, completion
tracking, a grid picker, and a fully authored first pack of 12 (including one 5-wave tutorial).

## References

- GDD §10.8, §10.4, §11.1 · TR §4.2, §5, §9, §13

## Requirements

1. `data/puzzles.json`: 50 unique ids with name, stars (1–3), pack. Pack 1 has `waves` and is
   playable. Packs 2–5 are catalog stubs (locked).
2. `mode: 'puzzle'`, command `loadPuzzle`. Full turn loop. Fixed HP and lanes. Grants on each
   wave. No shop. `nextWave` from `waveCleared`.
3. Puzzle sessions never write the run save. Cleared ids persist in `mt:<basePath>:puzzles`.
4. Menu Puzzles opens the grid. Back top-left. Tap playable to start. Locked tiles shake.
   Stars, name, check, lock. HUD Home returns to the book. Hide coins. Show HP and wave dots.
5. Lose → Play again (restart that scenario) and Back to the book. Win → check mark, back to
   the book.
6. Pack 1 proven solvable with all-exact kills (`scenarios/puzzles/`, `tests/puzzleSolutions.test.ts`).
7. Keep `levels.json` + `mode: 'level'` as the FIRE-only harness.

## Acceptance Criteria

- [x] 50 catalog entries; 12 playable Pack 1 scenarios
- [x] Picker + completion + lose Play again
- [x] Pack 1 solutions pass; puzzles never overwrite the saved run
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

**Status:** Complete
**Completed:** 2026-09-20
**PR:** #62 · Preview: https://mathtactics.timtsu.com/pr/pr-62/

**Acceptance criteria:**
- [x] 50 catalog entries; 12 playable Pack 1 scenarios — Met
- [x] Picker + completion + lose Play again — Met
- [x] Pack 1 solutions pass; puzzles never overwrite the saved run — Met
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass — Met (101 e2e)

**Verification:** npm test ✔ (883) · typecheck ✔ · lint ✔ · build ✔ · e2e ✔ (101)

**Deviations from spec:**
- Theme is conceptual, not a catalog field (human: "remove the theme").
- The old 8 M1 tutorial boards are one 5-wave scenario (`warm-up`), not eight tiles.
- Unlock is content-lock (`waves` missing), not a skill gate. All 12 Pack 1 tiles are open.
- After the first picker, the human asked to hide stubs, sort by stars, use fewer columns, and scroll. The book is a 4-column scrolling grid of playable tiles only (GDD §10.8 updated).
- `screen: 'levelSelect'` is reused for the book so the FIRE-only harness can keep `allDone`.
- Occupied allows a robot and a tile to share a cell (schema rejects only duplicate tiles among tiles / robots among robots).
- Wave 1 `cannons` replace slots; later waves add listed cannons. Tiles persist across waves.
- Puzzle lose e2e drives Occupied to `lost` by installing `baseHp: 1` (catalog HP is 100; one robot cannot empty the base).

**Architectural decisions made:**
- New `mode: 'puzzle'` + `loadPuzzle`. `mode: 'level'` stays FIRE-only (`levels.json`).
- `buildPuzzleState` / `buildPuzzleNextWave` live in `sim/commands/puzzle.ts`. Grants emit `TilesGranted` / `CannonPlaced`.
- `nextWave` from `waveCleared` when `mode === 'puzzle'`; otherwise shop. Puzzles skip wave-clear coins; last wave uses `sessionWaveCount`.
- Completion is device-local `mt:<basePath>:puzzles` `{ completed: string[] }`, same shape as seen-tiles. Mid-session is never saved. `isEndedSession` vs `isFinishedRun`: only ladder wins/losses clear the run save.
- Picker is React (`PuzzleSelectScreen`). 4-column scrolling grid of playable tiles only, easy first. Back top-left. HUD Home from a puzzle returns to the book.

**Design questions raised:**
- None open. Lose Play again / catalog-all-50 / no theme / tutorial-as-one-scenario were answered before implementation.

**Known issues / follow-up:**
- Packs 2–5 are catalog stubs and stay hidden until they have `waves`.
- iPad landscape feel of the 4-column scrolling book (name length, star size, scroll) still wants a human check on the preview.
- Debug Jump still lists FIRE-only `levels.json` ids, not puzzle-book ids.

**Files created:** `data/puzzles.json`, `sim/commands/puzzle.ts`, `game/state/puzzleFlow.ts`, `game/ui/PuzzleSelectScreen.tsx`, `tasks/32-puzzle-book.md`, `e2e/puzzles.spec.ts`, `tests/puzzleSolutions.test.ts`, `tests/sim/commands/loadPuzzle.test.ts`, `tests/sim/data/puzzles.test.ts`, `tests/game/puzzleFlow.test.ts`, `scenarios/puzzles/01-warm-up.scenario.yaml` … `12-recipe.scenario.yaml`

**Files modified:** `GDD.md`, `TECHNICAL_REFERENCE.md`, `TASKS.md`, `sim/core/types.ts`, `sim/commands/applyCommand.ts`, `sim/commands/index.ts`, `sim/data/schemas.ts`, `sim/data/load.ts`, `sim/resolve/resolveTurn.ts`, `sim/scenario/parse.ts`, `sim/scenario/run.ts`, `game/state/store.ts`, `game/state/storage.ts`, `game/state/runFlow.ts`, `game/state/waveFlow.ts`, `game/state/gameData.ts`, `game/state/index.ts`, `game/ui/App.tsx`, `game/ui/Hud.tsx`, `game/ui/LoseScreen.tsx`, `game/ui/WinScreen.tsx`, `game/ui/WaveClearedOverlay.tsx`, `game/ui/MainMenu.tsx`, `game/ui/icons.tsx`, `game/ui/ui.css`, `e2e/app-shell.spec.ts`, `e2e/levels.spec.ts`, `e2e/run-flow.spec.ts`, `e2e/debug.spec.ts`, `e2e/difficulty.spec.ts`, plus fixtures/`loadDataFiles`/`validRaw` consumers that now require `puzzles`.

**Notes for next agent:**
- `mode: 'puzzle'` is the player book; `mode: 'level'` is still the FIRE-only harness. Do not fold them. A later pack is authored by adding `waves` to an existing catalog id in `data/puzzles.json` plus a `scenarios/puzzles/` solution — the picker unlocks from `waves` alone.
