# Math Tactics — Tasks

Status values: `Not Started` · `In Progress` · `Partial` · `Complete` · `Blocked`.
Each task has a spec in `tasks/`. Start with `/start <NN>`; close with `/finish-task`.
Tasks within a milestone may run in parallel when their dependencies are complete.

## M0 — Foundation

Gate: a blank board renders on the iPad via `https://mathtactics.timtsu.com`.

| # | Task | Layer | Depends on | Status |
|---|---|---|---|---|
| 01 | [Project scaffold & tooling](tasks/01-project-scaffold.md) | infra | — | Complete |
| 02 | [CI, GitHub Pages & PR previews](tasks/02-ci-and-deploy.md) | infra | 01 | Complete |
| 03 | [App shell: Phaser + React layering, scaling, iPad web shell](tasks/03-app-shell.md) | presentation | 01 | Complete |
| 04 | [Core types, RNG & data schemas](tasks/04-core-types-and-data.md) | sim / data | 01 | Complete |
| 05 | [Store, persistence scoping & test handle](tasks/05-store-and-test-handle.md) | state | 03, 04 | Complete |
| H0 | **Human:** DNS CNAME, Pages settings, branch protection; open production URL on iPad, add to Home Screen | human | 02, 03 | Complete |

## M1 — Core Loop

Gate: **Playtest 1** — is building an equation fun?

| # | Task | Layer | Depends on | Status |
|---|---|---|---|---|
| 06 | [Planning commands & undo](tasks/06-planning-commands.md) | sim | 04 | Complete |
| 07 | [Fire resolution & impact](tasks/07-fire-resolution.md) | sim | 04 | Complete |
| 08 | [Scenario runner](tasks/08-scenario-runner.md) | sim / tooling | 06, 07 | Complete |
| 09 | [Board rendering & drag-and-drop](tasks/09-board-and-drag.md) | presentation | 05, 06 | Complete |
| 10 | [Playback director](tasks/10-playback-director.md) | presentation | 07, 09 | Complete |
| 11 | [Puzzle levels & level flow](tasks/11-puzzle-levels.md) | data / presentation | 08, 10 | Complete (iPad check pending) |
| H1 | **Human: Playtest 1** — play levels with your son; record notes in `playtests/01.md` | human | 11 | Complete |

## M2 — A Run

Gate: **Playtest 2** — does a run hold together? Specs written before Playtest 1 (GDD v0.4);
ladder content is finalized after it (task 17). Tasks 14, 15 and 16 may run in parallel once 13 is merged.

| # | Task | Layer | Depends on | Status |
|---|---|---|---|---|
| 12 | [Wave data & spawning](tasks/12-wave-data-and-spawning.md) | sim / data | — | Complete |
| 13 | [Full turn loop: advance, detonation, waves, win/lose](tasks/13-full-turn-loop.md) | sim | 12 | Complete |
| 14 | [Save/resume, main menu & Home](tasks/14-save-resume-and-menu.md) | state / ui | 13 | Complete (iPad check pending) |
| 15 | [Run playback: spawn, advance, detonation, danger glow](tasks/15-run-playback.md) | presentation | 13 | Complete (iPad check pending) |
| 16 | [Wave-cleared, win & lose screens](tasks/16-wave-and-end-screens.md) | ui | 13 | Complete (iPad check pending) |
| 17 | [Ladder waves 1–3 & Playtest 2 checklist](tasks/17-ladder-waves-1-3.md) | data / e2e | 14, 15, 16, H1 | Complete |
| H2 | **Human: Playtest 2** — play a full run with your son; record notes in `playtests/02.md` | human | 17 | Complete |

## M3 — Economy

Gate: **Playtest 3** — is the shop a real choice? Specs written before Playtest 2 (GDD v0.6);
the M2 wave-reward stand-in is removed in task 19, and ladder content (task 21) is authored after H2.
A run becomes 7 waves and losable for the first time.

| # | Task | Layer | Depends on | Status |
|---|---|---|---|---|
| 18 | [Shop data, pricing & offer generation](tasks/18-shop-data-and-offers.md) | sim / data | — | Complete |
| 19 | [Shop phase, commands & run flow](tasks/19-shop-phase-and-flow.md) | sim / state | 18 | Complete |
| 20 | [Shop screen, seen-tiles log & NEW badge](tasks/20-shop-screen-and-seen-log.md) | ui / state | 19 | Complete (iPad check pending) |
| 21 | [Ladder waves 4–7, balance, full-run e2e & Playtest 3 checklist](tasks/21-ladder-waves-4-7.md) | data / e2e | 19, 20, H2 | Complete |
| H3 | **Human: Playtest 3** — play a 7-wave run with your son; record notes in `playtests/03.md` | human | 21 | Complete |

## M4 — Traits & Finale

Gate: **Playtest 4** — does a complete 10-wave run hold together once traits are visible and the
Boss is in? Specs written after Playtest 3 (GDD v0.7). Trait *rules* already resolve in `/sim`;
this milestone telegraphs them, swaps the first teaching trait into waves 4/6/7, and extends the
run to 10 waves.

Playtest 3: fun but too easy. Waves 4–7 get a HP bump and one teaching trait each on 4/6/7
(Weakness-5, Bounce-back grill A, Odd-only); wave 5 stays all `basic` (grill A). A clean
7-wave run still ends at 80–100 HP. Waves 8–9 do the real chipping (10-wave leftover min
near 40, median 50–70). The Boss is untraited, HP 100–150, exact-killable in ≤ 3 hits (grill A).
Wave 10 escort is T1 one + T7 two. Leaking the Boss is a loss. A sloppy run can lose on 8–9
and never see the Boss. Waves 8–9 may spawn `basic`; Even-only can roll at wave 8 T1 (grill B).
Wave 8 is 3+3 (grill A). Wave 9 has more robots than 8 (four at once **and** an extra pack).
Shop after 7 guarantees `×2` or `×5` (grill A). Shop after 8 guarantees nothing (grill A).
Shop after 9 guarantees `−N` (grill A). Procedural packs draw without replacement (grill B).
Wave 8 T1/T8 pools are split (grill A). Wave 9 uses one shared full mix (grill A). Waves 1–3
unchanged. Armor is **deferred to v1.1+**.

**Order and shared files.** 22 first and alone: it fixes the balance bot every later number is
measured with (the shipped bot is trait-blind — swapping the traits in with no HP change at all
already costs 29 HP on the worst of 100 seeds, none of it real difficulty). Then 23 and 25 in
parallel, and 24 at any time — it shares nothing with the others. 26 needs 25 merged (wave 10
makes wave 9 non-final, and the schema then demands 25's `afterWave: 9` table) and 23 merged
(it reuses 23's `RobotView` chrome seam). 27 last. Shared files to expect conflicts in:
`data/waves.json` and `tests/ladder.test.ts` (22, 25, 26), `sim/data/schemas.ts` (25, 26),
`game/board/views/RobotView.ts` + `BoardRenderer.ts` (23, 26), `e2e/run.spec.ts` (25, 26, 27).
Each of 25 and 26 changes `waves.json`'s length, which moves the HUD wave dots and the
detonation `heartTargetX` — both specs carry the fallout list.

| # | Task | Layer | Depends on | Status |
|---|---|---|---|---|
| 22 | [Trait templates, trait-aware balance bot & waves 4/6/7 swap](tasks/22-trait-templates-and-ladder-swap.md) | data / tests | — | Complete |
| 23 | [Trait telegraph on the board](tasks/23-trait-telegraph.md) | presentation | 22 | Complete (iPad check pending) |
| 24 | [Settings screen & planning hints](tasks/24-settings-and-hints.md) | ui / board | — | Not Started |
| 25 | [Shop 7–9 & procedural waves 8–9](tasks/25-procedural-waves-8-9.md) | sim / data | 22 | Partial (leftover median 99, not 50–70) |
| 26 | [Wave 10 Boss](tasks/26-wave-10-boss.md) | data / presentation | 22, 23, 25 | Not Started |
| 27 | [10-wave balance, e2e & Playtest 4 checklist](tasks/27-full-run-and-playtest-4.md) | data / e2e | 23, 24, 25, 26 | Not Started |
| H4 | **Human: Playtest 4** — play a complete run with your son; record notes in `playtests/04.md` | human | 27 | Not Started |

## M5 — Juice & Art *(specs written after Playtest 4)*

Chain escalation · exact-kill celebration · bounce-back & clonk beats · purchase juice ·
seen-tiles gallery · sound (Web Audio) · AI-generated art pass · kid-facing title decision · **v1**
