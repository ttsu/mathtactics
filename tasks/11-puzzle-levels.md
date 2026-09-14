# 11 — Puzzle Levels & Level Flow

**Milestone:** M1 · **Layer:** data / presentation · **Depends on:** 08, 10 · **Branch:** `task/11-puzzle-levels`

## Task

Author a short sequence of hand-made puzzle levels that exercise the M1 core loop, and add the
minimal flow to play them in order on the iPad — so Playtest 1 can answer "is building an
equation fun?"

## References

- GDD §1.1, §4.2, §5.5, §10.2 (spirit of waves 1–2, 5) · TR §4.1

## Context

M1 has no waves, advancing, shop, or traits in play. Levels are static boards: robots stand still, the
player arranges the tiles they're given, and fires until every robot is gone. Firing repeatedly is allowed
(brute force is fine, GDD §4.2). This is a test harness for fun, not final content.

## Requirements

1. **8 levels in `levels.json`,** each with a scenario file in `/scenarios/levels/` proving it is solvable
   with an exact kill on every robot (commands = a known solution; `expectEvents` all `exact: true`).
   Suggested progression (adjust if a better teaching order emerges; note changes):
   1. One cannon, one robot 1 HP, no tiles. (Tap End Turn → exact kill.)
   2. Robot 3 HP, cannon starts in the wrong lane, tray has `+2`. (Move the cannon; 1 + 2 = 3.)
   3. Two tiles `+3`, `+5`; robot 9 HP. (1 + 3 + 5.)
   4. `+5`, `×2`; robot 12 HP. (Order matters: (1+5)×2 = 12, not 1×2+5 = 7.)
   5. Robot standing on a `×3` tile; robot 8 HP; tray `+1`, `+2`, `×2`. (Can't use the ×3.)
   6. Two lanes, two robots (7 HP and 10 HP), one cannon, tiles for both. (Move the cannon between turns.)
   7. `−N` introduced: `×5`, `−3`, `+1`; robot 7 HP. ((1+1)×5−3 = 7.)
   8. Capstone: two cannons, three robots, 6 tiles, target values 15, 24, 11.
2. **Level flow (React):** main menu with a big ▶ Play; level intro is text-free (just the board);
   `levelCleared` → celebration overlay with a big ▶ Next button; after level 8 → "all done" screen with ▶ Play again.
   Level progress is kept in memory only (no save in M1).
3. A small, unobtrusive level indicator (e.g. dots) in the HUD.
4. e2e: for each level, `loadLevel` → apply the known solution via `dispatch` → `skipAnimation` →
   `getState().phase === 'levelCleared'`.
5. Write `playtests/01-checklist.md` for the human: what to watch for (does he move the cannon unprompted? does he
   predict values? does he react to exact kills? where does he get stuck? does he want to keep going?), plus a
   blank notes section.

## Acceptance Criteria

- [ ] 8 levels, each proven solvable with all-exact kills by a passing scenario
- [ ] Levels playable start to finish on the iPad preview with no text required
- [ ] e2e solves every level through the test handle
- [ ] Playtest checklist exists
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

**Status:** Not Started
