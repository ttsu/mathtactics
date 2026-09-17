# 27 — 10-Wave Balance, e2e & Playtest 4 Checklist

**Milestone:** M4 · **Layer:** data / e2e · **Depends on:** 23, 24, 25, 26 · **Branch:** `task/27-full-run-and-playtest-4`

## Task

Prove a 10-wave run with traits, shops 7–9, procedural 8–9, and the Boss is winnable by a
sensible player and losable by a careless one; play it end to end through the real UI; write
the Playtest 4 checklist.

## References

- GDD v0.7 §0, §6.6, §8.2, §10.1–10.2, §12.2 · TR §9, §12, §16.1
- `playtests/03-checklist.md` Notes — **read first**
- Task 21 Completion Notes — sensible-player policy, shop buy order, recorded stats
- `tests/ladder.test.ts`, `tests/helpers/sensiblePlayer.ts`, `e2e/run.spec.ts`

## Context

Tasks 22–26 stacked: traits on 4/6/7, telegraph, settings, waves 8–10, Boss. Playtest 3 said
too easy. Waves 4–7 leftover is locked: sensible player ends the 7-wave stretch at 80–100 HP.
Waves 8–10 do the real damage. After the Boss: min near 40 (still ≥ 40, and min ≤ 55 so the
floor is actually used), median 50–70. Do **not** retune waves 1–3. Do **not** add armor.

Settings/hints are not part of the sensible-player bot (hints off is the default a kid gets).

The bot itself became trait-aware in task 22 (it ranks arrangements through `resolveImpact`).
Every number below assumes that. If a leak shows up here, check whether the bot could have
killed the robot and chose not to before you touch HP — a parity-blind or bounce-blind leak is a
test bug, not difficulty.

The hooks this task's e2e calls are owned elsewhere: `getHints()` and the
`menu-settings` / `settings` / `settings-hints` / `settings-home` testids come from task 24,
`getRobotChrome()` from task 23. If any of them landed under a different name, follow the code
and say so in Completion Notes rather than adding a second hook.

## Requirements

1. **Read Playtest 3 notes** and the Completion Notes of 22–26. If they already retuned 8–9,
   do not reverse that without a new reason.

2. **Balance tests** (`tests/ladder.test.ts`, shipped data, seeds 1–100), same two bots as
   task 21 (real `applyCommand`, never a reimplementation):

   - sensible player **wins** every seed; leftover base HP **min ≥ 40 and min ≤ 55**,
     **median in 50–70** (grill B);
   - End-Turn-only **loses** every seed;
   - every shop visit (after 1–9) offers the sensible player at least one affordable item;
   - second cannon still affordable by the shop after wave 3;
   - Boss is exact-killable in ≤ 3 hits (grill A) with the tiles the sensible player owns on
     entering wave 10 — task 22's `canExactKillInAtMostNHits(robot, values, n)` with `n = 3`,
     search bound the same way as task 21's ≤ 2-hit check;
   - record in Completion Notes: turns per wave (min/median/max), full-run End Turns, coins
     earned/spent per shop, purchases, final base HP, and how often wave 8/9 leaked.

3. **e2e** (`e2e/run.spec.ts`): menu → New Game through the real buttons → loop { planning:
   sensible-player via `dispatch` / `endTurn` / `skipAnimation`; wave-cleared: tap ▶; shop:
   buy a real affordable card then ▶ *Next wave* } through wave 10 → win screen → ▶ Home →
   menu with no Keep Going. Include a reload **inside a shop after wave 8** → Keep Going →
   same offers → finish. Keep the turn cap above the measured max.

   Plus a short e2e: menu → Settings → Hints on → Home → New Game → after placing (or
   dispatching) one tile in an armed lane, `getHints()` (task 24) is non-empty.

   Budgets: `MAX_TURNS` in the spec and `MAX_END_TURNS` (400) in the bot helper were sized for
   7 waves (measured max 51 End Turns). Re-measure on 10 and leave headroom; a bot that
   silently hits the cap throws rather than reporting a loss.

4. **`playtests/04-checklist.md`** in the task-11/17/21 format. Question: **does a complete
   run hold together — traits readable, stretch hard enough, Boss a finale, and does he want
   to go again?** Setup: Home Screen, fresh **New Game**, sound on — and say why: a run saved
   by the M3 build resumes into the 10-wave ladder through ▶ Keep Going (the save schema did
   not change, so it is not discarded), which is not what Playtest 4 is measuring. Watch for:
   - Does he read Weakness n / Bounce-back coil / Odd vs Even without being told?
   - Wrong-parity clonk: confusion or "oh, even"?
   - Bounce-back overshoot: does he reach for `−N`?
   - Wave 8–9: frustration or focus? Too long? Does he lose here and never see the Boss?
   - Boss: does three-digit HP land as special? (May not appear if he lost on 8–9.)
   - Settings / hints: does he find them? Does turning hints on change how he plays?
   - After win/lose: another run?
   - Session length, waves reached, per-wave notes, quotes, bugs, ideas for M5.

5. Update `TASKS.md`: H4 ready.

## Out of Scope

Armor. M5 juice, sound playback, art pass. Changing the 40 HP floor. Kid-facing title.

## Acceptance Criteria

- [ ] Sensible player wins seeds 1–100: leftover min ≥ 40 and ≤ 55, median 50–70; End-Turn-only loses
- [ ] Boss exact-killable in ≤ 3 hits on entering wave 10, checked trait-aware
- [ ] e2e plays a full 10-wave run through menus, shop, and a mid-shop reload
- [ ] Settings/hints e2e covers the task-24 hook
- [ ] Turn budgets re-measured for 10 waves (spec `MAX_TURNS`, helper `MAX_END_TURNS`)
- [ ] `playtests/04-checklist.md` exists
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e`, `npm run sim -- scenarios` pass

## Completion Notes

**Status:** Partial
**Completed:** 2026-09-17
**PR:** #47 · Preview: https://mathtactics.timtsu.com/pr/pr-47/ · Branch: `cursor/27-full-run-playtest-4-fa99`

**Acceptance criteria:**
- [~] Sensible player wins seeds 1–100: leftover min ≥ 40 and ≤ 55, median 50–70; End-Turn-only loses — Partial: every seed wins; End-Turn-only loses; leftover **min 56 / median 99 / max 100**. Min ≥ 40 holds; min ≤ 55 and median 50–70 do not. CI asserts win + min ≥ 40, not a fake 50–70 band.
- [x] Boss exact-killable in ≤ 3 hits on entering wave 10, checked trait-aware — Met (`canExactKillInAtMostNHits(boss, values, 3)` exact-only; search bound = task 21 `reachableBallValues`, ≤ 3 tiles, tiles not consumed). Holds for seeds 1–100 after the HP cap below.
- [x] e2e plays a full 10-wave run through menus, shop, and a mid-shop reload — Met (`e2e/run.spec.ts`: New Game → 10 waves → win → ▶ Home, no Keep Going; reload inside shop after wave 8 → Keep Going → same offers → finish)
- [x] Settings/hints e2e covers the task-24 hook — Met (`e2e/run.spec.ts` short path + existing `e2e/settings.spec.ts`; testids `menu-settings` / `settings` / `settings-hints` / `settings-home`; `getHints()` non-empty after one `placeTile`)
- [x] Turn budgets re-measured for 10 waves — Met: End Turns **50/66/92**; `MAX_TURNS = 200`; helper `MAX_END_TURNS = 400`
- [x] `playtests/04-checklist.md` exists — Met
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e`, `npm run sim -- scenarios` pass — Met

**Verification:** npm test ✔ (65 files / 741 tests) · typecheck ✔ · lint ✔ · build ✔ · e2e ✔ (80 WebKit) · `npm run sim -- scenarios` ✔ (42/42)

**Leftover-HP (sensible player, trait-aware bot, seeds 1–100):**

| | min | median | max |
|---|---|---|---|
| final base HP | 56 | 99 | 100 |
| min base HP during run | 56 | 99 | 100 |

v0.7 band (min ≥ 40 **and** min ≤ 55, median 50–70) is unreachable with this 3-cannon trait-aware bot + locked 3+3 / 4+4+3 packs. Task 25 leftover is unchanged: raising 8–9 HP further caused a disaster tail (seed 61 loss) without moving the median. Wave 10 escort chips **0** (0/100 leaked). No new leftover lever used.

**Turns per wave (min/median/max End Turns):**

| Wave | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| min | 3 | 3 | 4 | 5 | 4 | 4 | 4 | 4 | 7 | 2 |
| median | 6 | 6 | 4 | 6 | 5 | 6 | 7 | 9 | 13 | 3 |
| max | 9 | 14 | 11 | 13 | 8 | 11 | 14 | 14 | 21 | 5 |

Full-run End Turns **50/66/92**. `MAX_TURNS = 200` and `MAX_END_TURNS = 400` both have headroom. `heartTargetX` stays **475**.

**Leaks (seeds with HP loss on that wave):** wave 8 **38/100** (hpLost max 18) · wave 9 **49/100** (hpLost max 8) · wave 10 **0/100**. Median hpLost is 0 on every wave — typical seeds still finish at 99–100.

**Shops (earned / spent / leftover / coins on enter; min/median/max):**

| after | earned | spent | leftover | on enter | notable buys (count / 100) |
|---|---|---|---|---|---|
| 1 | 9/9/9 | 8/8/8 | 1/1/1 | 9/9/9 | add:5 61, add:4 59, add:3 40 |
| 2 | 9/9/9 | 6/10/10 | 0/0/4 | 10/10/10 | mul:2 78, mul:3 22 |
| 3 | 11/11/11 | 10/10/14 | 1/1/1 | 11/11/15 | **cannon 100** (second cannon) |
| 4 | 11/13/13 | 10/12/14 | 0/2/4 | 12/14/14 | mul:5 41, mul:4 26, mul:3 21, mul:2 21 |
| 5 | 11/11/11 | 4/8/15 | 0/3/7 | 11/13/15 | cannon 41 (third), −N |
| 6 | 11/13/13 | 8/15/19 | 0/1/6 | 11/16/20 | cannon 52 |
| 7 | 13/15/15 | 10/14/19 | 0/2/8 | 14/16/21 | mul:5 33, mul:3 29, mul:2 28, mul:4 26 |
| 8 | 11/14/15 | 6/12/19 | 0/5/10 | 11/17/23 | mixed; no guarantee |
| 9 | 19/23/25 | 12/24/29 | 0/5/11 | 19/28/34 | upgrade 64, −N (sub:10 25, sub:7 26, sub:8 20) |

Every shop after 1–9 had an affordable item. Second cannon by the shop after wave 3 on every seed.

**Deviations from spec:**
- Branch name is `cursor/27-full-run-playtest-4-fa99` (cloud-agent convention) rather than `task/27-full-run-and-playtest-4`.
- Leftover median 99, not 50–70; leftover min 56, not ≤ 55. Honest CI: wins + min ≥ 40. Do not name a test 50–70 that only checks ≥ 50.
- **Boss HP authored range `[100, 140]`**, not grill A `[100, 150]`. Binding 3-hit failure is **seed 75 @ HP 141** (max ball 48, only `×2`); seed 77's mul-poor tray (max ball 54) fails 145/146/148/149. Cap at 140 is the largest contiguous range starting at 100 that 3-hits every seed 1–100. Schema still allows Boss HP 150.
- Hints e2e uses `loadScenario` after New Game to put a tray tile on an armed lane (fresh run tray is empty) — same as task 24.
- `playtests/04-checklist.md` uses ▶ **Keep Going** / **New Game** (shipped labels), not M3's Continue / New Run.

**Architectural decisions made:**
- `SensibleRunStats.hpLostPerWave` records base-HP delta per wave (waveCleared for 1–9, terminal phase for 10) so leak counts are measured, not eyeballed.
- Boss 3-hit uses the wave-10 entry snapshot: the `isBoss` robot only, `reachableBallValues` from owned tiles, `n=3`, exact-only.

**Design questions raised:**
- **10-wave leftover median 50–70 vs this bot.** Typical seeds exact-kill 4-lane packs of HP ≤ 99 (3 cannons, developed tray). Unlucky trait rolls detonate a whole robot (min 56). Uniform HP on locked 3+3 / 4+4+3 cannot both pull the bulk into 50–70 and keep min ≥ 40 / no losses. Wave 10 escort is a kid-facing trap, not a leftover lever (0/100 leaked). Needs a new design lever (not armor, not more 8–9 HP, not undoing 4/6/7 teaching traits). Accept median ~99 until then.
- **Boss HP 140 vs grill A 150.** Cap is so the weakest sensible-player tray still 3-hits. A kid who buys ×10 will 3-hit 150. Is 140 enough of a three-digit finale, or should shop-after-9 grow a mul guarantee instead?

**Known issues / follow-up:**
- H4 Playtest 4 on the iPad (checklist in `playtests/04-checklist.md`). Start from a **fresh New Game** — an M3 save resumes into the 10-wave ladder via ▶ Keep Going.
- Tasks 23, 24, 26 iPad preview checks still pending.
- Armor still deferred.

**Files created:** `playtests/04-checklist.md`
**Files modified:** `data/waves.json`, `tests/ladder.test.ts`, `tests/helpers/sensiblePlayer.ts`, `e2e/run.spec.ts`, `TASKS.md`, this file

**Notes for next agent:**
- Leftover is still Partial (56/99/100). Do not grind waves 8–9 HP; do not undo teaching traits on 4/6/7; do not retune 1–3; do not add armor. Boss shipped range is **`[100, 140]`**. `MAX_TURNS = 200` (measured max 92). `heartTargetX` is 475 for 10 dots. Hints hook is `getHints()`; Settings testids unchanged. H4 is unblocked.

