# 23 — Trait Telegraph on the Board

**Milestone:** M4 · **Layer:** presentation · **Depends on:** 22 · **Branch:** `task/23-trait-telegraph`

## Task

Make each trait readable during planning without words. An untelegraphed Bounce-back robot reads as
a bug (GDD v0.6 §0, v0.7 §0). Bounce-back bar refill and blocked clonk already play from task 10 —
do **not** add M5 juice (escalation, louder celebrations).

## References

- GDD §6.2–6.4, §11.1–11.2, §12.2 (planning-phase cues) · TR §11.1, §14 (test handle)
- `game/board/views/RobotView.ts`, `game/board/BoardRenderer.ts` (`syncRobots`,
  `ensureRobotView`), `game/board/playback/SegmentPlayer.ts`, `game/board/views/palette.ts`
- `data/presentation.json` (new `traits` colours live here — CLAUDE.md rule 3)

## Context

`RobotView` is one grey block with a single antenna and an HP number. Trait is on `Robot` and on
`RobotSpawned` but the view ignores it. Playback already handles `RobotBouncedBack` (bar overshoots
and settles) and `BallBlocked` (clonk). This task is the **planning-phase** silhouette.

Robot views are created in **two** places, and neither has a trait today:
`BoardRenderer.syncRobots` (from `run.board.robots`, which carries `trait`) and
`BoardRenderer.ensureRobotView(robotId)`, called by `SegmentPlayer` when a spawn beat introduces a
robot mid-sequence (the `RobotSpawned` / `RobotWaiting` events carry `trait`). `reconcile.ts` is
only `diffKeys` / `planCannons` — there is no robot reconciliation module to edit.

HP remains the largest element on the robot. Trait chrome is secondary.

**Shared seam with task 26.** The Boss needs the same treatment (an oversized sprite keyed on
`robot.isBoss`) through the same two creation sites. This task owns the seam: give `RobotView` one
post-construction entry point that takes the robot's appearance (e.g.
`setChrome({ trait, isBoss })`, idempotent, rebuilding only when the value changes), call it from
both sites, and say so in Completion Notes. Task 26 then only adds the Boss branch.

## Requirements

1. **`presentation.json` `traits`** — add a schema'd object (no hardcoded colours in views):

   ```json
   "traits": {
     "weaknessNColor": "#ffd54f",
     "oddShieldColor": "#7e57c2",
     "evenShieldColor": "#26a69a",
     "bounceBackBodyColor": "#ef6c00"
   }
   ```

   Hex values may be tuned in Completion Notes; the keys may not. Contrast must keep the HP
   numeral readable (GDD §11.2).

2. **`RobotView` telegraphs `robot.trait`**, applied from both creation sites above (a trait
   never changes during a run, but the view is built before the trait is known, so the entry
   point must be safe to call again with the same value). Sizes follow the existing board
   constants in `game/board/layout.ts` (`ROBOT_SIZE`, `ROBOT_HP_FONT_SIZE`, …); only colours are
   data. Exact shapes are the implementer's, with these **must-reads**:

   | Trait | Must read as |
   |---|---|
   | `none` | Today's block (one antenna). No extra chrome. |
   | `weakness` | The number **n** (2, 5, or 10) on the chest, smaller than HP, colour `weaknessNColor`. |
   | `bounceBack` | A coiled / springy silhouette (not a second HP). Body uses `bounceBackBodyColor`. |
   | `oddOnly` | One unpaired feature (single antenna or single eye) **and** a shield wash in `oddShieldColor`. |
   | `evenOnly` | Matched pairs (two antennae or two eyes) **and** a shield wash in `evenShieldColor`. |

   Wrong-parity shield colour is "what hurts it" (GDD §6.3). Do not label ODD/EVEN with letters.

3. **Test handle** (TR §14) — the board is a canvas, so there is no DOM to assert on and a DOM
   overlay is not an option (GDD §11.2: the board's numbers are Phaser text). Add one hook,
   wired like `renderedBoard()` (board-side implementation injected from `game/main.tsx`,
   declared on `TestHandle` in `game/state/testHandle.ts`):

   ```ts
   getRobotChrome(robotId: string): {
     trait: Trait['type'];
     n: number | null;        // Weakness chest number, else null
     pairCount: number;       // unpaired/paired feature count (odd = 1, even = 2)
     coiled: boolean;
     shieldColor: string | null;
     hpFontSize: number;      // design points, for the legibility assertion
   } | null;
   ```

   Keep it a description of what is drawn, read off the live view — not a re-derivation from
   `run`. Task 27's e2e uses it as well, so land the shape here and record it in TR §14.

4. **Tests:**
   - Unit: a pure `traitChrome(trait, colours)` helper returns a distinct descriptor per trait
     type (weakness exposes `n`, odd vs even differ in `pairCount`, bounce-back is `coiled`), and
     `RobotView` renders from it. Prefer the pure helper as the assertion seam so the test needs
     no Phaser scene; the existing Phaser test pattern in `tests/game/` is the fallback.
   - e2e: install a board with one robot of each trait via `window.__GAME__.loadScenario(...)` —
     the scenario board grammar already writes traits (`R20:w5`, `R20:bb`, `R20:odd`,
     `R20:even`, TR §12), so this needs no wave play and no ladder coupling — then assert
     `getRobotChrome` per robot and that the HP text is still present via `renderedBoard()`.
     Playing three waves to reach wave 4 is not required and would couple this spec to task 22's
     tuning.

5. **Legibility:** any change that makes HP harder to read is a regression (CLAUDE.md rule 6).
   Weakness `n` must not out-scale HP. Assert it, don't eyeball it: the unit test compares the
   chest numeral's font size against `ROBOT_HP_FONT_SIZE`.

6. **Human check.** Trait chrome is a presentation task, so it is merged after the human looks at
   the PR preview on the iPad (`TASKS.md` M3 precedent: "Complete (iPad check pending)"). Put a
   one-screen shot of all four traits in the PR body, and leave the iPad criterion unchecked
   with "awaiting human check on preview".

## Out of Scope

Boss overflow scale (26 — but this task owns the `setChrome` seam it will use). Hint numbers
(24). M5 bounce-back / clonk juice. Armor.

## Acceptance Criteria

- [ ] Each trait is visually distinct during planning; `none` unchanged
- [ ] Weakness shows n; odd/even show unpaired vs paired + shield colour; bounce-back is coiled
- [ ] Chrome is applied from both `syncRobots` and `ensureRobotView`, through one entry point
- [ ] Colours come from `presentation.json` `traits`
- [ ] `getRobotChrome` is on the test handle and recorded in TR §14
- [ ] HP remains the largest numeral on the robot (asserted, not eyeballed)
- [ ] `npm test`, `typecheck`, `lint`, and a targeted e2e pass
- [ ] iPad preview check — awaiting human

## Completion Notes

**Status:** Complete (iPad check pending)
**Completed:** 2026-09-17
**PR:** TBD · Preview: TBD

**Acceptance criteria:**
- [x] Each trait is visually distinct during planning; `none` unchanged — Met (screenshot `/opt/cursor/artifacts/23-trait-telegraph.png`; iPad still pending)
- [x] Weakness shows n; odd/even show unpaired vs paired + shield colour; bounce-back is coiled — Met
- [x] Chrome is applied from both `syncRobots` and `ensureRobotView`, through one entry point — Met (`RobotView.setChrome`)
- [x] Colours come from `presentation.json` `traits` — Met
- [x] `getRobotChrome` is on the test handle and recorded in TR §14 — Met (shape unchanged from the M4 sketch)
- [x] HP remains the largest numeral on the robot (asserted, not eyeballed) — Met (`traitChrome` chest font `< ROBOT_HP_FONT_SIZE`; e2e `hpFontSize`)
- [x] `npm test`, `typecheck`, `lint`, and a targeted e2e pass — Met
- [ ] iPad preview check — awaiting human check on preview

**Verification:** npm test ✔ (63 files / 696 tests) · typecheck ✔ · lint ✔ · build ✔ · e2e ✔ (`e2e/trait-telegraph.spec.ts` webkit)

**Deviations from spec:**
- Branch name is `cursor/23-trait-telegraph-fa99` (cloud-agent convention) rather than `task/23-trait-telegraph`.
- `RobotWaiting` has no `isBoss` field (only `RobotSpawned` does). Spawn chrome for a waiter passes `isBoss: false`. Wave-10 Boss arrives via `RobotSpawned`, which already carries `isBoss`.
- Weakness chest `n` sits at the bottom of the block (`WEAKNESS_N_FONT_SIZE` 22 vs HP 56) so it cannot out-scale HP. It overlaps the lower edge of a two-digit HP; gold + stroke keeps it a second number. Hex values are the spec defaults; not tuned.

**Architectural decisions made:**
- Chrome seam (task 26 adds the Boss branch **inside** `setChrome` only — do not add a third creation path):

  ```ts
  RobotView.setChrome({ trait, isBoss }: RobotAppearance): void
  BoardRenderer.ensureRobotView(robotId: string, appearance?: RobotAppearance): RobotView
  ```

  `RobotAppearance = { trait: Trait; isBoss: boolean }`. Idempotent: rebuilds only when `trait`/`isBoss` change. `isBoss` is stored in the key and is a no-op this PR (no scale).
- `syncRobots` calls `setChrome({ trait: robot.trait, isBoss: robot.isBoss })` from `run.board.robots`.
- `SegmentPlayer` spawn beats (`RobotSpawned` / `RobotWaiting`, including `finish()`) call `ensureRobotView(id, appearance)` so mid-sequence spawns go through the same entry point.
- Pure `traitChrome(trait, colours)` in `game/board/views/traitChrome.ts` (Phaser-free) is the unit-test seam. `getRobotChrome` reads `RobotView.getChrome()` — what is drawn, not a re-derivation from `run`.
- Sizes in `layout.ts` (`WEAKNESS_N_FONT_SIZE`, `ROBOT_ANTENNA_SPREAD`); only colours in `presentation.json` `traits`.

**Design questions raised:**
- None. Weakness-n overlap vs HP is a presentation call for the iPad check; do not shrink HP.

**Known issues / follow-up:**
- Task 26: add `presentation.json` `boss.scale` and apply it in `setChrome` when `isBoss`. Do not change `ensureRobotView` / `syncRobots` signatures further.
- Task 24: `getHints` is still a TR §14 stub.
- iPad preview check still required before merge.

**Files created:** `game/board/views/traitChrome.ts`, `tests/game/traitChrome.test.ts`, `e2e/trait-telegraph.spec.ts`
**Files modified:** `data/presentation.json`, `sim/data/schemas.ts`, `game/board/views/RobotView.ts`, `game/board/views/palette.ts`, `game/board/layout.ts`, `game/board/BoardRenderer.ts`, `game/board/playback/SegmentPlayer.ts`, `game/board/createBoardGame.ts`, `game/main.tsx`, `game/state/testHandle.ts`, `tests/helpers/playbackSettings.ts`, `tests/game/{layout,store,testHandle}.test.ts`, `tests/sim/data/{load,levels,shop,waves}.test.ts`, `tests/sim/commands/{fixtures.ts,loadLevel.test.ts}`, `TASKS.md`, this file

**Notes for next agent:**
- Task 26 only adds the Boss branch inside `RobotView.setChrome`. Both creation sites already pass `isBoss`. `RobotView` stores silhouette graphics as `silhouette`, not `body` — `Container.body` is Phaser's physics body and shadowing it fails the typecheck.

