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
