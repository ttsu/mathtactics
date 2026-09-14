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

**Status:** Not Started
