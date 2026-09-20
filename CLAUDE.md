# Math Tactics — Agent Guide

A turn-based math lane-defense game for a 7-year-old, played on an iPad. Cannons fire balls;
`+N` / `−N` / `×N` tiles transform them; damage = ball value on impact; exact kills are the
core reward.

**Read before working:**
- `GDD.md` — game design (source of truth for rules)
- `TECHNICAL_REFERENCE.md` — architecture (source of truth for structure)
- `TASKS.md` and your task file in `tasks/`

## Core Rules

1. **`/sim` has no rendering dependency.** No Phaser, React, DOM, `Math.random`, or `Date.now` in `/sim`.
   If you are about to import one, stop — you are in the wrong layer.
2. **Every gameplay change ships with a test** asserting on the event list (unit test and/or scenario file).
3. **No hardcoded tuning values.** Numbers go in `/data/*.json` (GDD §13).
4. **Run `npm test` before declaring work complete.** Always. Also `npm run typecheck` and `npm run lint`.
5. **Do not invent design decisions.** If the GDD doesn't cover it, raise it with the human.
   Record unavoidable minor calls in your task's Completion Notes under "Deviations".
6. **Legibility over cleverness.** Any change that makes a number harder to read is a regression.
7. **Presentation never changes outcomes.** Anything that changes a number is simulation;
   anything that only changes how it feels is presentation.
8. **If you can drag it, it lives in Phaser.** Buttons and screens live in React.
   Phaser and React communicate only through `/game/state`.

## v1 Scope Guardrails

v1 has **only** `+N`, `−N`, `×N` tiles; one cannon per lane in column 0; one ball per armed lane
per turn; robots with speed 1, no attack; traits Weakness / Bounce-back / Odd-only / Even-only.
**Do not implement** path tiles, count tiles, Barrier, Splitter, robot speed, rerolls, selling,
or interest — see GDD §19.

## Commands

```
npm run dev          # Vite dev server (test handle enabled)
npm test             # vitest: /sim, data schemas, scenarios  ← default verification
npm run typecheck    # tsc (app + sim-without-DOM configs)
npm run lint         # eslint (includes layer boundary rules)
npm run sim -- <path>   # run scenario file(s), print diff
npm run build        # production build
npm run test:e2e     # Playwright WebKit, iPad landscape
```

## Pinned Versions

Install exactly these (no `^`/`~`). Agent training data is mostly **Phaser 3** — Phaser 4 APIs
differ. Check Phaser 4 docs/types in `node_modules/phaser` before using an API from memory.

| Package | Version |
|---|---|
| Node | 24 (`.nvmrc`) |
| phaser | 4.2.1 |
| react / react-dom | 19.3.0 |
| vite | 8.3.0 |
| @vitejs/plugin-react | 6.1.1 |
| typescript | 6.0.3 (typescript-eslint does not yet support TS 7) |
| typescript-eslint | 8.70.0 |
| eslint | 10.10.0 |
| prettier | 3.9.6 |
| vitest | 5.0.0 |
| @playwright/test | 1.63.0 |
| zod | 4.6.5 |
| zustand | 5.0.15 |
| @foleyjs/core | 2.9.0 |

Changing a pinned version requires updating this table and noting why in Completion Notes.

## Layout

```
/sim     pure simulation     /game/state  store, persistence, test handle
/data    JSON tuning         /game/board  Phaser 4
/tests   vitest              /game/ui     React
/e2e     Playwright          /scenarios   rule scenario YAML
/tasks   task specs          /scripts     CLIs
```

## Workflow

- One task = one branch (`task/NN-slug`) = one PR = one preview at
  `https://mathtactics.timtsu.com/pr/pr-<N>/`.
- `/start <NN>` begins a task; `/finish-task` writes Completion Notes and updates `TASKS.md`.
- CI (typecheck, lint, test, build, e2e) must be green. Presentation tasks are merged after the human
  checks the preview on the iPad.
- Commit messages: imperative, reference the task (`M1-07: resolve per-ball impact`).

## Terminology

Use GDD §17.2 terms exactly: ball, cannon, cannon slot, armed lane, base value, tile, tray, robot,
trait, Boss, base, detonation, locked cell, turn, wave, run, ladder, exact kill, overkill, blocked,
hint, playback.
