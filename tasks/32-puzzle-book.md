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

- [ ] 50 catalog entries; 12 playable Pack 1 scenarios
- [ ] Picker + completion + lose Play again
- [ ] Pack 1 solutions pass; puzzles never overwrite the saved run
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

_(filled by `/finish-task`)_
