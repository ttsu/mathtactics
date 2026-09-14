# 08 — Scenario Runner

**Milestone:** M1 · **Layer:** sim / tooling · **Depends on:** 06, 07 · **Branch:** `task/08-scenario-runner`

## Task

Implement the human-authorable scenario format, a pure parser/runner, the `npm run sim` CLI with
readable diffs, a vitest suite that runs every scenario, and a starter library of core-rule scenarios.

## References

- GDD §15.1 · TR §12, §14 (`loadScenario`)

## Requirements

1. `/sim/scenario/parse.ts`: YAML → `Scenario` (validated with Zod). Board token grammar per TR §12:
   `C`, `.`, `+N`, `-N`, `xN` (also accept `×`/`−`), `R<hp>`, `R<hp>[tile]`, trait suffixes `:bb`, `:odd`,
   `:even`, `:w2|:w5|:w10`. Exactly 5 lane rows × 8 tokens; col 0 only `C` or `.`; clear errors with row/column.
2. `/sim/scenario/run.ts`: build initial `RunState` (reuse task 06 level construction where possible), apply
   `commands` (string shorthand `endTurn`, `undo`, or object form of any `Command`), then compare:
   - `expectEvents`: ordered subsequence, partial object match.
   - `expectState`: partial deep match.
   - optional `expectError` for a command.
   Returns a structured result (pass/fail, first mismatch, actual events).
3. `/scripts/sim.ts` (`npm run sim -- <file-or-dir>`): runs one file or all `*.scenario.yaml` recursively;
   prints ✔/✘ per scenario; on failure prints expected vs. actual around the first mismatch and the full
   actual event list compactly (one line per event). Exit code 1 on any failure.
4. `/tests/scenarios.test.ts`: generates one vitest test per scenario file.
5. Starter scenarios in `/scenarios/core/` (at least): exact kill order of operations; robot-on-tile denial;
   tile beyond robot not applied; overkill normal kill; undershoot survive; negative ball 0 damage;
   unarmed lane; locked-cell `expectError`; each trait (bounce-back overshoot cap, odd-only block,
   even-only zero, weakness doubling exact kill).
6. Export `parseScenario` + state builder for the test handle's `loadScenario` (wire it in `/game/state/testHandle.ts`).

## Acceptance Criteria

- [ ] `npm run sim -- scenarios` passes all starter scenarios
- [ ] A deliberately wrong expectation produces a readable diff and exit code 1 (verify manually; note output in Completion Notes)
- [ ] Malformed board rows produce errors naming the row and column
- [ ] `npm test` runs every scenario
- [ ] `__GAME__.loadScenario` installs a scenario's initial state
- [ ] `npm test`, `typecheck`, `lint` pass

## Completion Notes

**Status:** Complete

**Acceptance criteria:**

- [x] `npm run sim -- scenarios` passes all starter scenarios — Met: 12/12 pass (see Verification).
- [x] A deliberately wrong expectation produces a readable diff and exit code 1 — Met, verified manually (see Verification; the wrong scenario itself was not committed).
- [x] Malformed board rows produce errors naming the row and column — Met: `sim/scenario/parse.ts` reports e.g. `scenario board row 3 (lane 2), col 2: unrecognized token "Q" ...` and `scenario board row 3 (lane 2): expected 8 space-separated tokens, got 3` (verified manually, see Verification).
- [x] `npm test` runs every scenario — Met: `tests/scenarios.test.ts` generates one `it(...)` per discovered `*.scenario.yaml` file.
- [x] `__GAME__.loadScenario` installs a scenario's initial state — Met: `game/state/testHandle.ts` now parses + builds + installs via the same `installState` path as `loadState`; covered by a unit test (`tests/game/testHandle.test.ts`) and an e2e test (`e2e/test-handle.spec.ts`).
- [x] `npm test`, `typecheck`, `lint` pass — Met (see Verification).

**Verification:**

- `npm test` — 22 files, 217 tests passed (includes 12 new scenario tests in `tests/scenarios.test.ts` and one updated + no new count change in `tests/game/testHandle.test.ts`, whose `loadScenario` case now asserts real installed state instead of a thrown error).
- `npm run typecheck` — `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.sim.json --noEmit`, both clean.
- `npm run lint` — `eslint .`, 0 errors/warnings (one `preserve-caught-error` finding on the YAML-parse catch in `parse.ts`, fixed by attaching `{ cause: err }`).
- `npm run build` — clean production build.
- `npm run check:no-test-handle` — `OK — no "__GAME__" found in "dist"`.
- `npm run test:e2e` — 13/13 Playwright (WebKit) tests passed, including the new `loadScenario` e2e test.
- `npm run sim -- scenarios`:
  ```
  ✔ scenarios/core/exact-kill-order-of-operations.scenario.yaml — (1 + 4) × 3 − 2 is an exact kill on 13 HP
  ✔ scenarios/core/locked-cell-expect-error.scenario.yaml — placing a tile onto a robot's cell is denied
  ✔ scenarios/core/negative-ball-zero-damage.scenario.yaml — a negative ball value deals zero damage
  ✔ scenarios/core/overkill-normal-kill.scenario.yaml — overkill is a normal kill, not an exact kill
  ✔ scenarios/core/robot-on-tile-denial.scenario.yaml — a tile under a robot does not apply to the ball that hits it
  ✔ scenarios/core/tile-beyond-robot-not-applied.scenario.yaml — a tile past the first robot in a lane never applies
  ✔ scenarios/core/trait-bounce-back-overshoot-cap.scenario.yaml — bounce-back overshoot is capped at max HP
  ✔ scenarios/core/trait-even-only-zero.scenario.yaml — even-only robots block odd balls
  ✔ scenarios/core/trait-odd-only-block.scenario.yaml — odd-only robots block even balls
  ✔ scenarios/core/trait-weakness-doubling-exact-kill.scenario.yaml — weakness doubling can land an exact kill
  ✔ scenarios/core/unarmed-lane.scenario.yaml — a lane with no cannon never fires
  ✔ scenarios/core/undershoot-survive.scenario.yaml — undershoot damage leaves the robot standing

  12/12 scenarios passed.
  ```
- **Manual check — deliberately wrong expectation** (not committed): a scratch scenario with `expectEvents: [{ type: RobotDamaged, damage: 999 }]` and `expectState: { coins: 42 }` against a normal-kill board produced (exit code confirmed `1`):
  ```
  ✘ .../wrong.scenario.yaml — deliberately wrong expectation
    expected event {"type":"RobotDamaged","damage":999} (position 0 of the sequence) not found, in order, among:
    [ ...full actual event list, pretty-printed... ]
    expectState mismatch at "coins": expected 42, got 1
    actual events:
      0: [0] fire:lane:2 LaneStarted lane=2
      1: [1] fire:lane:2 BallFired ballId="ball:0" lane=2 at={"lane":2,"col":0} value=10
      ... (one compact line per event) ...

  0/1 scenarios passed.
  EXIT CODE: 1
  ```
- **Manual check — malformed board rows**: a bad token (`"C R5 Q . . . . ."`) reported `scenario board row 3 (lane 2), col 2: unrecognized token "Q" (expected ".", a tile like "+4"/"-2"/"x3", or a robot like "R13"/"R13[x3]"/"R13:bb")`; a short row (`"C R5 ."`) reported `scenario board row 3 (lane 2): expected 8 space-separated tokens, got 3`. Both exit 1.

**Deviations from spec / minor calls made:**

- **`expectError` semantics**: the brief says only "optional `expectError` for a command" without fixing which one. Decided: `expectError` (a single `CommandError` value) applies to the *last* command in `commands`. Every earlier command must succeed; the last command must fail with exactly that error (processing stops there) — if `expectError` is absent, every command including the last must succeed. This covers the one starter case that needs it (`locked-cell-expect-error.scenario.yaml`) without inventing an index-addressed multi-error scheme the brief never asked for.
- **Command grammar scope**: "object form of any `Command`" was narrowed to `placeTile`/`moveTile`/`returnTile`/`moveCannon`/`undo`/`endTurn` — the only commands meaningful against a scenario-built state. `loadLevel`/`newRun`/`buyOffer`/`leaveShop` are excluded (the first two don't make sense once a state already exists; the shop commands are out of v1 scope per CLAUDE.md's guardrails and still return `wrong_phase` from `applyCommand`).
- **`waiting[].trait` and `maxHp`**: TR §12 shows trait shorthand (`:bb`/`:odd`/`:even`/`:wN`) only on board tokens. For the optional `waiting` (off-board) robots, reused the same shorthand as a plain `trait: <code>` string field (rather than a nested `{ type: ... }` object) for consistency with the board grammar, and added `maxHp` (defaulting to `hp`, validated `maxHp >= hp`) since off-board robots are the one place a scenario might need to distinguish current HP from max HP. No starter scenario needed `waiting` or a mismatched `maxHp` — GDD §6.2's overshoot-cap example (10 HP robot hit for 25 → capped at 10) is reachable at full health, since `min(|hp − damage|, maxHp)` can exceed `maxHp` even when `hp === maxHp`.
- **`levelId` derivation**: `scenario:<slug>`, where the slug comes from `sourceName` (the file's basename with `.scenario.yaml` stripped) when the caller provides one — `scripts/sim.ts`, `tests/scenarios.test.ts`, and both test-handle tests all pass one — and falls back to slugifying `name` otherwise (e.g. `__GAME__.loadScenario(yamlText)` with no filename).
- **Matcher move**: `matchEventSequence`/`partialMatches` moved into `sim/scenario/match.ts` per the controller ruling; `partialMatches` is now derived from a new `findPartialMismatch`, which also powers `expectState`'s "readable diff" (returns the first mismatching path + expected/actual values, not just a boolean) — `tests/helpers/eventSequence.ts` re-exports the same `matchEventSequence` unchanged, so existing tests using `expectEventSequence` needed no changes.
- **Tile-cell grammar note**: `R<hp>[tile]`'s inner tile and top-level board tiles share one regex/parser (`parseTileToken`), so `+N`/`-N`/`−N`/`xN`/`×N` behave identically in both positions — not calling this out as a deviation exactly, just confirming it's one implementation, per CLAUDE.md rule 6 (legibility) and rule 1 (one place for a rule).

**Design questions raised:** None — the rulings supplied with the task covered every open call.

**Known issues / follow-up:**

- `mode: 'run'` scenarios build state (`mode: 'run'`) but `resolveTurn` only runs FIRE for that mode today (task 07's M2 TODO) — per the ruling, no `run`-mode scenario was added.
- The CLI (`scripts/sim.ts`) and the vitest suite (`tests/scenarios.test.ts`) each call `discoverScenarioFiles`/`scenarioSlugFromPath` (`tests/helpers/scenarioFiles.ts`) independently rather than sharing one "run scenarios and report" entry point — kept the CLI thin per the task's "Code Organization" note, with the small amount of duplicated wiring (parse → run → report) left in each caller rather than adding a third abstraction layer for two call sites.

**Files created:** `sim/scenario/parse.ts`, `sim/scenario/run.ts`, `sim/scenario/match.ts`, `tests/scenarios.test.ts`, `tests/helpers/scenarioFiles.ts`, `scenarios/core/*.scenario.yaml` (12 files: `exact-kill-order-of-operations`, `robot-on-tile-denial`, `tile-beyond-robot-not-applied`, `overkill-normal-kill`, `undershoot-survive`, `negative-ball-zero-damage`, `unarmed-lane`, `locked-cell-expect-error`, `trait-bounce-back-overshoot-cap`, `trait-odd-only-block`, `trait-even-only-zero`, `trait-weakness-doubling-exact-kill`)

**Files modified:** `sim/scenario/index.ts` (real barrel, was task-01 placeholder), `scripts/sim.ts` (real CLI, was a stub), `game/state/testHandle.ts` (`loadScenario` implemented; `loadState`/`loadScenario` now share an `installState` helper), `tests/game/testHandle.test.ts` (`loadScenario` case now asserts installed state instead of a thrown error), `tests/helpers/eventSequence.ts` (delegates to `sim/scenario/match.ts`; `expectEventSequence` behavior unchanged), `e2e/test-handle.spec.ts` (added a `loadScenario` e2e test), `TASKS.md` (status for task 08)

**Notes for next agent:**

- Task 11 (puzzle levels & level flow) adds a `level:` key to the scenario format per its own brief — this task deliberately did not add one.
- `Scenario.expectState` is an arbitrary partial `RunState` shape (`Record<string, unknown>`, unchecked by zod beyond "is an object") — a typo'd key silently never matches rather than erroring; if that turns out to bite scenario authors, `findPartialMismatch` (`sim/scenario/match.ts`) is the place to add stricter key validation later.
- `sim/scenario/index.ts` is the intended import surface for the scenario runner (`game/state/testHandle.ts` and `scripts/sim.ts` both go through it) — prefer it over reaching into `parse.ts`/`run.ts`/`match.ts` directly from outside `/sim/scenario`.
