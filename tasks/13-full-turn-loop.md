# 13 — Full Turn Loop: Advance, Detonation, Waves, Win/Lose

**Milestone:** M2 · **Layer:** sim · **Depends on:** 12 · **Branch:** `task/13-full-turn-loop`

## Task

Complete `resolveTurn` for `mode: 'run'`: ADVANCE, DETONATE, END CHECK, fast-forward and SPAWN; wave clear
with coins and tile rewards; `nextWave`; win and loss; the run-wide exact-kill count. Extend the scenario runner
so all of it is testable as scenario files.

## References

- GDD §0 (v0.4), §3.3, §4 (all, incl. §4.4), §7, §8.2, §10.1, §10.3, §10.5, §10.6 · TR §5, §6, §7, §12

## Context

**Consequence of the rules worth knowing:** because ADVANCE runs front-most first and robots move 1 cell, on-board
robots are never actually blocked in v1, and col 7 is always free at SPAWN except for a robot that entered earlier in
the same SPAWN step. Waiting only happens when two robots are due in one lane at once (or a waiter and a new one).

After task 12, `newRun` starts a run with wave 1's first robot on the board, and `rollWave`/SPAWN exist.
`resolveTurn` still has `// TODO(M2): advance, detonate, end check, spawn`. Level mode must keep behaving exactly
as today (FIRE only).

## Requirements

1. **`resolveTurn` for `mode: 'run'`**, exactly per TR §6 "`mode: 'run'` details":
   - **ADVANCE** (group `"advance"`): on-board robots in `(col asc, lane asc)` order; col 1 → leaves the board, queued
     to detonate, cell freed for followers in the same step; else move left if the cell has no robot
     (`RobotAdvanced`), else stay. Waiting robots don't advance.
   - **DETONATE** (group `"detonate:<lane>"`): queued robots in lane order; `RobotDetonated { damage: hp }`, then
     `BaseDamaged { amount, hpBefore, hpAfter }`. `baseHp` is not clamped in state.
   - **END CHECK** (group `"end"`): lost → `RunLost`, phase `lost` (wins over a same-turn wave clear, GDD §4.1).
     Wave clear (no pending spawns, no robots incl. waiting) → `WaveCleared`, `CoinsChanged` (`income.waveCleared`,
     reason `waveCleared`); last wave → `RunWon`, phase `won`; otherwise `TilesGranted` (reward tiles appended to
     the tray as new pieces from `nextIds.piece`, in listed order; event emitted even if the reward is empty so
     presentation has one shape), phase `waveCleared`.
   - **Continue:** `turn += 1`, fast-forward (GDD §4.4 / TR §6), then SPAWN (task 12's function).
2. **`exactKills`:** `+1` for every `RobotDefeated { exact: true }` in any mode.
3. **`nextWave` command:** phase `waveCleared` only (else `wrong_phase`). `waveIndex += 1`, `turn = 1`, roll the next
   wave (`wave` stream), SPAWN, phase `planning`, `lastTurnEvents: []`, `undo: []`. Board tiles, tray, cannons,
   coins, base HP, and `exactKills` carry over. Returns the spawn events.
4. Planning commands and `endTurn` return `wrong_phase` in `waveCleared`, `won`, `lost` (check existing guards).
5. **Scenario runner** (TR §12): keys `pendingSpawns` (`{ turn, lane, hp, robot? }`, robot defaults to `basic`),
   `exactKills`, `waves` (inline authored waves replacing `data.waves` for that scenario; validated with the same
   schema); commands `nextWave` and `{ newRun: <seed> }`. `mode: run` scenarios with a `board` start in phase `planning`.
6. **Scenarios** in `/scenarios/run/` (each uses inline `waves` so tuning ladder content never breaks them):
   - robot on col 1 not killed → detonates for remaining HP; base HP drops
   - chip damage: robot worn down then detonates for the remainder
   - a queue of robots in one lane all advance together (front-most first frees each cell)
   - front robot killed during FIRE → the robot behind it advances into the freed cell in that turn's ADVANCE
   - col-1 robot detonates and the robot behind it moves into col 1 in the same ADVANCE
   - two robots due in the same lane on the same turn → one spawns, one waits; the waiter enters next turn
   - fast-forward: board emptied with spawns remaining → `turn` jumps, robots spawn in the same resolution
   - wave clear → coins, `TilesGranted`, phase `waveCleared`; `nextWave` → next wave's robots, tiles kept in place
   - final wave clear → `RunWon`, phase `won`, no `TilesGranted`
   - base ≤ 0 on the turn the wave would clear → `RunLost`, phase `lost`, no `WaveCleared`
   - detonations resolve in lane order across two lanes

## Tests

- Unit tests for ADVANCE ordering (front-most first, lane tiebreak, freed col 1, a chain of 3 adjacent robots in a
  lane all moving). Keep the "stay if the cell ahead has a robot" branch (GDD §4 step 4) even though front-most-first
  ordering with speed 1 means it can't trigger in v1 — unit-test it directly on the helper.
- `resolveTurn` level mode: existing tests and all `/scenarios/levels` still pass unchanged.
- Determinism: same state → deep-equal output; `step` strictly increasing across groups; group order
  `fire:lane:* → advance → detonate:* → end → spawn`.
- **Termination property:** for seeds 1–50, `newRun` then only `endTurn` (and `nextWave` when in `waveCleared`)
  always reaches `won` or `lost` within a bound (e.g. 200 End Turns) using the shipped `waves.json`.
- `nextWave` wrong phase; `exactKills` counts across waves.

## Acceptance Criteria

- [ ] `mode: 'run'` resolves the full GDD §4 turn with fast-forward, events per TR §6/§7
- [ ] Wave clear pays coins and grants reward tiles; final wave wins; base ≤ 0 loses (and beats a same-turn clear)
- [ ] `nextWave` starts the next wave with board/tray/cannons carried over
- [ ] Scenario runner supports `pendingSpawns`, `exactKills`, `waves`, `nextWave`, `newRun`
- [ ] `/scenarios/run/` scenarios above pass; level scenarios unchanged
- [ ] `npm test`, `typecheck`, `lint`, `npm run sim -- scenarios` pass

## Completion Notes

**Status:** Complete
**Completed:** 2026-09-15

**Acceptance criteria:**
- [x] `mode: 'run'` resolves the full GDD §4 turn with fast-forward, events per TR §6/§7 — Met
  (`sim/resolve/advance.ts`, `sim/resolve/detonate.ts`, END CHECK + fast-forward + SPAWN in `resolveTurn.ts`;
  groups `advance`, `detonate:<lane>`, `end`, `spawn`)
- [x] Wave clear pays coins and grants reward tiles; final wave wins; base ≤ 0 loses (and beats a same-turn clear) — Met
- [x] `nextWave` starts the next wave with board/tray/cannons carried over — Met (`sim/commands/nextWave.ts`)
- [x] Scenario runner supports `pendingSpawns`, `exactKills`, `waves`, `nextWave`, `newRun` — Met
- [x] `/scenarios/run/` scenarios above pass; level scenarios unchanged — Met (11 run scenarios, one per requirement 6 bullet)
- [x] `npm test` (511 tests), `typecheck`, `lint`, `npm run sim -- scenarios` (31/31) pass — Met; `npm run build` also passes

**Deviations from spec:**
- **Scenario `waves:` is structurally validated only.** It reuses the now-exported `WavesFileSchema` (turn-1 spawn,
  lane letters, last wave has no reward), but robot/tile ids are not cross-checked against `robots.json`/`tiles.json`
  at parse time — `parseScenario` has no `GameData` (TR §12). An unknown robot id still fails loudly in `spawn()`
  (`unknown robot template "..."`).
- **Reward tile ids are not validated at grant time.** `resolveTurn` creates a `TilePiece` per reward id verbatim; shipped
  `waves.json` is validated at load, so this only matters for a hand-authored scenario `waves:` with a typo.
- **Fast-forward reads `pendingSpawns[0]` as the earliest entry.** True because `rollWave` stable-sorts by turn and
  `spawn()` removes due entries from the front. Hand-written scenario `pendingSpawns` out of turn order would break it
  (not checked at parse).
- `decideAdvance(robot, isOccupied)` is exported so the "stay" branch (unreachable through the full sweep in v1) is
  unit-tested directly, as the Tests section asks.
- `TilesGranted` is emitted with `tiles: []` when a non-final wave has no/empty reward (one shape for presentation).

**Architectural decisions made:**
- New exports: `advance(board, firstStep)`, `decideAdvance(robot, isOccupied)` (`sim/resolve/advance.ts`);
  `detonate(detonating, baseHp, firstStep)` (`sim/resolve/detonate.ts`); `buildNextWave(state, data)`
  (`sim/commands/nextWave.ts`); `WavesFileSchema` (`sim/data/schemas.ts`).
- Types: `Phase` gains `'waveCleared'` (the M2 stand-in for the shop slot, GDD §10.5); `Command` gains
  `{ type: 'nextWave' }`; `GameEvent` gains `TilesGranted { tiles: { pieceId, tileId }[] }` (group `"end"`).
- DETONATE re-sorts queued robots by lane explicitly rather than relying on ADVANCE's incidental order.
- `exactKills` is counted once from FIRE's `RobotDefeated { exact: true }` events, in both `level` and `run` mode.
- Scenario runner: `effectiveData(scenario, data)` in `sim/scenario/run.ts` substitutes an inline `waves:` for
  `data.waves.waves` for every command in the scenario (`endTurn`, `nextWave`, `{ newRun }`).
- Existing `phase !== 'planning'` guards already reject planning commands and `endTurn` in `waveCleared`/`won`/`lost`
  (requirement 4) — no code change needed.

**Known issues / follow-up needed:**
- Out-of-order scenario `pendingSpawns` silently mis-fast-forward (no sorted check at parse).
- `waveIndex` past the end of `waves` gives a bare `TypeError` in the `resolveTurn` end check (`resolveTurn.ts` ~87, ~95)
  rather than a readable error. Unreachable through real commands.
- Run scenarios hardcode `economy.json` values (coins delta 2/3, coins 5); an economy retune will need them updated.
- The scenario runner's `exactKills` override and `{ newRun }` command are only covered by parse tests.
- Test gaps: exactKills-across-waves only checks carry-over; no test that requirement 4's guards reject commands in
  `waveCleared` specifically; `nextWave` is missing from the null-state command list test.
- Misplaced `runScenario` JSDoc in `sim/scenario/run.ts`; unrelated Prettier churn in `sim/scenario/parse.ts`.
- End Turn only (never placing a tile) wins every seed on the shipped draft waves — intended for M2 (task 17 retunes).

**Files created:**
- `sim/resolve/advance.ts`, `sim/resolve/detonate.ts`, `sim/commands/nextWave.ts`
- `scenarios/run/*.scenario.yaml` (11 files)
- `tests/sim/resolve/advance.test.ts`, `tests/sim/resolve/detonate.test.ts`, `tests/sim/resolve/resolveTurnRun.test.ts`,
  `tests/sim/commands/nextWave.test.ts`, `tests/sim/termination.test.ts`

**Files modified:**
- `sim/core/types.ts`, `sim/resolve/resolveTurn.ts`, `sim/resolve/index.ts`, `sim/commands/index.ts`,
  `sim/commands/applyCommand.ts`, `sim/data/schemas.ts`, `sim/scenario/parse.ts`, `sim/scenario/run.ts`
- `tests/sim/scenario/parse.test.ts`, `TASKS.md`

**Notes for next agent:**
- Presentation should treat `TilesGranted` with `tiles: []` as "no pop-in", not "event missing".
- `newRun`/`nextWave` return a `spawn`-only event list; `endTurn` groups run
  `fire:lane:* → advance → detonate:<lane> → end → spawn`.
- `run.baseHp` can go negative in state and events; clamp only for display.
- New run scenarios should use inline `waves:` so ladder tuning (task 17) never breaks them.
