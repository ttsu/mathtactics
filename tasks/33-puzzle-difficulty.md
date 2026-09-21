# 33 — Puzzle Book Difficulty

**Milestone:** M5 · **Layer:** data / tests · **Depends on:** 32 · **Branch:** `cursor/harder-puzzles-9d86`

## Task

Pack 1 is too easy. Retune the 12 playable scenarios so 1-star stays simple, 2-star is
moderately challenging, and the 3-star Recipe is a genuine exact-amount exam.

## References

- GDD §10.8, §6.2 · `data/puzzles.json` · `scenarios/puzzles/` · `tests/puzzleSolutions.test.ts`

## Requirements

1. **1 star** stays simple: one idea, small numbers, overkill is fine. Warm Up remains the
   tutorial. Plus Party and Five Bolt may add robots/rounds but must stay obvious.
2. **2 stars** are moderately challenging: more robots, more HP, more waves or multi-turn
   waves, rearranging tiles, traits. Overkill may still work on non-bounce-back robots.
3. **3 stars (Recipe)** is genuinely difficult. Every robot is Bounce-back so overkill does
   not clear. More robots, more HP, more rounds (up to 5 waves). The player must build the
   exact amount.
4. Every playable puzzle ships a known all-exact-kill solution (`scenarios/puzzles/`,
   `tests/puzzleSolutions.test.ts`). Catalog stubs stay stubs.
5. Keep the 12 Pack 1 ids, names, and star counts. Do not invent new playable tiles.

## Acceptance Criteria

- [ ] 1-star puzzles remain simple; 2-star have more robots / HP / rounds than Pack 1 shipped
- [ ] Recipe uses bounce-back on every robot and is 5 waves
- [ ] Every playable puzzle has a passing exact-kill solution
- [ ] `npm test`, `typecheck`, `lint` pass

## Completion Notes

**Status:** Complete
**Completed:** 2026-09-21
**PR:** #63 · Preview: https://mathtactics.timtsu.com/pr/pr-63/

**Acceptance criteria:**
- [x] 1-star puzzles remain simple; 2-star have more robots / HP / rounds than Pack 1 shipped — Met. Warm Up unchanged (tutorial). Plus Party 2→5 robots / 3 waves. Five Bolt 2→6 robots / 3 waves. 2-star boards are 6–9 robots, 3–4 waves, HP into the 20–60 band.
- [x] Recipe uses bounce-back on every robot and is 5 waves — Met (16 bounce-back robots, HP up to 48). Asserted in `tests/sim/data/puzzles.test.ts`.
- [x] Every playable puzzle has a passing exact-kill solution — Met (`tests/puzzleSolutions.test.ts`, `npm run sim -- scenarios/puzzles` 12/12).
- [x] `npm test`, `typecheck`, `lint` pass — Met (885 tests).

**Verification:** npm test ✔ (885) · typecheck ✔ · lint ✔ · `npm run sim -- scenarios/puzzles` ✔ (12/12)

**Deviations from spec:**
- Warm Up was left as the 5-wave M1 tutorial. "Add more robots" applies to the rest of Pack 1; 1-star Warm Up staying simple was the human's star-band rule.
- Extra cannons were not added on Recipe. A second armed empty lane would fire 1 each turn and chip bounce-back HP. Difficulty is exact recipes plus robot count, not dual-cannon.

**Architectural decisions made:**
- Occupied board-tile cells persist into later waves (cannot `returnTile` after `waveCleared`). Later waves use unused cells; solutions return unlocked board tiles while another robot is still alive when a lane must be reused.
- Recipe stays one cannon. Bounce-back plus delayed spawns is the 3-star lever.

**Design questions raised:**
- None open. Star bands and bounce-back Recipe were the human request. Recorded in GDD v0.9.5 §10.8.

**Known issues / follow-up:**
- iPad feel of the new 2-star / Recipe length still wants a human play on the preview.
- Packs 2–5 remain catalog stubs.

**Files created:** `tasks/33-puzzle-difficulty.md`
**Files modified:** `data/puzzles.json`, `scenarios/puzzles/02`–`12`, `tests/sim/data/puzzles.test.ts`, `e2e/puzzles.spec.ts`, `GDD.md`, `TECHNICAL_REFERENCE.md`, `TASKS.md`

**Notes for next agent:**
- Recipe's solution in `scenarios/puzzles/12-recipe.scenario.yaml` is the existence proof, not the intended play path a 7-year-old must discover unaided. If playtests find it too long or still leakable, retune HP/count in `data/puzzles.json` and keep the bounce-back constraint.
