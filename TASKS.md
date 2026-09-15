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
| H1 | **Human: Playtest 1** — play levels with your son; record notes in `playtests/01.md` | human | 11 | Not Started |

## M2 — A Run *(specs written after Playtest 1)*

Waves & spawn schedules · robot advance & waiting · base HP & detonation · win/lose screens ·
save & resume · ladder waves 1–3 · **Playtest 2**

## M3 — Economy *(specs written after Playtest 2)*

Coins & income · shop screen & offer generation (separate RNG stream) · cannons & upgrades ·
seen-tiles log & NEW badge · ladder waves 4–7 (untraited versions until M4) · **Playtest 3**

## M4 — Traits & Finale *(specs written after Playtest 3)*

Weakness · Bounce-back · Odd-only / Even-only (visuals included) · waves 8–9 procedural ·
wave 10 Boss · settings screen & planning hints · **Playtest 4 (complete v1 run)**

## M5 — Juice & Art *(specs written after Playtest 4)*

Chain escalation · exact-kill celebration · bounce-back & clonk beats · sound (Web Audio) ·
AI-generated art pass · kid-facing title decision · **v1**
