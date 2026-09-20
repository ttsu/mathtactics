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

**Status:** Complete (human check pending: levels playable start to finish on the iPad preview)

**Acceptance criteria:**

- [x] 8 levels, each proven solvable with all-exact kills by a passing scenario — `scenarios/levels/01…08-*.scenario.yaml` (new `level:` key builds the real `levels.json` level). `tests/levelSolutions.test.ts` also checks the full event list: exactly one `RobotDefeated` per robot in the level, all `exact: true`, phase `levelCleared`, and one scenario per shipped level.
- [ ] Levels playable start to finish on the iPad preview with no text required — **pending human check.** Every flow button is an SVG glyph (▶ / ↻▶), ≥ 60pt (260×150), e2e-measured.
- [x] e2e solves every level through the test handle — `e2e/levels.spec.ts`: ▶ Play → `dispatch(loadLevel)` → the scenario file's solution via `dispatch` (`skipAnimation` after each End Turn) → `phase === 'levelCleared'`, overlay visible. Plus a menu → Play → End Turn button → overlay (only after playback) → Next → level 8 → Next → all done → Play again click-through.
- [x] Playtest checklist exists — `playtests/01-checklist.md` (level table with solutions, what to watch for, blank notes).
- [x] `npm test` (351), `typecheck`, `lint`, `build`, `check:no-test-handle`, `npm run sim -- scenarios` (20/20), `test:e2e` (40) pass.

**Levels (all robots stationary, base value 1):**

| # | id | Board | Known solution |
|---|---|---|---|
| 1 | level-1 | cannon lane 2; robot 1 HP (2,6) | End Turn |
| 2 | level-2 | cannon lane 1; robot 3 HP (3,6); tray +2 | move cannon 1→3, +2 → 1+2 = 3 |
| 3 | level-3 | cannon lane 2; robot 9 HP (2,6); tray +3 +5 | 1+3+5 = 9 |
| 4 | level-4 | cannon lane 2; robot 12 HP (2,6); tray ×2 +5 (×2 listed first, so tray order gives 7) | (1+5)×2 = 12 |
| 5 | level-5 | cannon lane 2; robot 8 HP on ×3 at (2,4); tray +1 +2 ×2 | (1+1+2)×2 = 8 in cols 1–3 |
| 6 | level-6 | cannon lane 1; robots 7 HP (1,6), 10 HP (3,6); tray +4 +6 ×2 | 1+6 = 7; move cannon 1→3; (1+4)×2 = 10 |
| 7 | level-7 | cannon lane 2; robot 7 HP (2,6); tray ×5 −3 +1 | (1+1)×5−3 = 7 |
| 8 | level-8 | cannons lanes 1, 2; robots 15 HP (1,6), 11 HP (3,4), 24 HP (3,7); tray +4 ×3 +5 ×2 −1 +2 | T1: move cannon 2→3; lane 1 (1+4)×3 = 15, lane 3 (1+5)×2−1 = 11. T2: return ×2 and −1, +2 at (3,2), move ×3 from lane 1 to (3,3): (1+5+2)×3 = 24 |

**Deviations from spec / minor calls made:**

- **Progression:** the suggested progression is used as written. Details filled in: level 2's cannon starts in lane 1 with the robot in lane 3; level 4's tray lists ×2 before +5 so placing in tray order gives the non-exact 7; level 6 uses +6 for 7 and +4/×2 for 10 (separate tile sets, so no tile moves needed); level 8 puts two robots in lane 3 (11 in front of 24), starts the second cannon in the empty lane 2, and has the 24 rebuilt by reusing tiles (the ×3 from the cleared lane 1) — six distinct tiles, many alternative solutions (e.g. (1+4−1)×3×2 = 24).
- **Scenario `level:` key:** mutually exclusive with `board`, and also with `baseValue` and `tray` (the level supplies all three; error names each conflicting key). `baseValue` is now only required with `board`. `Scenario` gains `level?`, `levelId` is the shipped id for level scenarios, `baseValue?` is optional. Unknown level id → `scenario level: unknown level id "…" (not in levels.json)` at build time. Other overrides (`coins`, `seed`, …) still apply. TR §12 updated.
- **Store:** `Screen` gains `'allDone'`; new `setScreen(screen)` action; initial screen is `'menu'`. The flow lives in `game/state/levelFlow.ts` (`levelPosition`, `firstLevelId`, `nextLevelId`, `showLevelCleared`, `startLevel`, `playFromStart`, `continueToNextLevel`); React reads the store API via new `useAppStoreApi()`. `continueToNextLevel` does nothing unless the run is `levelCleared`, so a double tap on ▶ Next can't skip a level. A level not in `levels.json` (e.g. a test-handle scenario) has no dots and ▶ Next goes to the first level. TR §9/§10/§14 updated.
- **Saved run not resumed (M1):** a run restored from storage stays in `run` but the menu doesn't offer Continue; ▶ Play always starts level 1. Progress is `run.levelId` in memory only.
- **HUD in level mode:** level dots (done = filled grey, current = bigger orange, later = hollow) replace "Wave N", and ♥ base HP is hidden (levels never damage the base, TR §4.1). Coins, Replay, Undo, End Turn unchanged. Run mode (and no run) still shows Wave/♥.
- **Screens:** the HUD is only rendered on the `game` screen. Main menu = decorative MATH VS ROBOTS title + big ▶. Level-cleared overlay = dark wash over board/HUD (blocks input), big gold star, large level dots with this level filled, big ▶ Next. All done = three stars, all dots filled, big ↻▶ Play again. Glyphs are SVG (iOS renders "▶" as an emoji).
- **Pop-in timing in data:** new `presentation.json` `screens.popInMs` (450) drives the star/button pop-in via a CSS variable (`animation-fill-mode: backwards` so the press-down `:active` transform still works afterwards). Fixtures gained `fakeScreenSettings()`.
- **Test handle:** `loadState`/`loadScenario` also set `screen: 'game'` (bypassing the menu). e2e `app-shell` HUD tests tap ▶ Play first; `test-handle.spec` expects `'menu'` on boot.

**Design questions raised:** None.

**Known issues / follow-up:**

- The ↻▶ Play again glyph resembles the HUD Replay icon (different screen, so unlikely to confuse).
- The large level dots on the cleared overlay sit over the board's lane 3 (behind the dark wash).
- Screenshots (not committed): `test-results/levels-menu-…-webkit/{menu,level-1,level-cleared,level-8-cleared,all-done}.png` after `npm run test:e2e`.

**Files created:** `scenarios/levels/0{1..8}-*.scenario.yaml`, `tests/levelSolutions.test.ts`, `tests/sim/scenario/levelKey.test.ts`, `tests/game/levelFlow.test.ts`, `game/state/levelFlow.ts`, `game/ui/{MainMenu,LevelClearedOverlay,AllDoneScreen,LevelDots,icons}.tsx`, `e2e/levels.spec.ts`, `playtests/01-checklist.md`

**Files modified:** `data/levels.json`, `data/presentation.json`, `sim/data/schemas.ts`, `sim/scenario/{parse,run}.ts`, `game/state/{store,testHandle,index}.ts`, `game/ui/{App,Hud,StoreContext}.tsx`, `game/ui/ui.css`, `tests/helpers/dragSettings.ts`, `tests/game/{store,testHandle}.test.ts`, `tests/sim/commands/{fixtures.ts,loadLevel.test.ts}`, `tests/sim/data/{load,levels}.test.ts`, `e2e/{app-shell,test-handle}.spec.ts`, `TECHNICAL_REFERENCE.md`, `TASKS.md`

**Notes for next agent:**

- M2: decide whether level mode stays (TR §4.1). The menu will need ▶ Continue for a saved run (GDD §10.4); `levelFlow.ts` is the place to branch on `run.mode`.
- A new level needs a `levels.json` entry **and** a `scenarios/levels/NN-*.scenario.yaml` with `level:` — `tests/levelSolutions.test.ts` fails otherwise.
