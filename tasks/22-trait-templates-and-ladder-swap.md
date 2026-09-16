# 22 — Trait Templates & Waves 4/6/7 Swap

**Milestone:** M4 · **Layer:** data · **Depends on:** — · **Branch:** `task/22-trait-templates-and-ladder-swap`

## Task

Ship the traited robot templates in `robots.json` and swap the first teaching trait onto ladder
waves 4, 6 and 7. No new rules — `/sim/resolve/impact.ts` already implements Weakness, Bounce-back
and Odd-only / Even-only. This task is data plus tests that the shipped ladder actually uses it.

This task produces **no new trait visuals**. Robots will look like `basic` until task 23. That is
acceptable for this PR; do not invent placeholder glyphs here.

## References

- GDD v0.7 §0, §6.1–6.5, §10.2 · TR §9 (`robots.json`, `waves.json`)
- `playtests/03-checklist.md` Notes — **read first** (too easy; armor is deferred to v1.1+)
- `data/robots.json`, `data/waves.json`, `tests/ladder.test.ts`, `tests/sim/resolve/impact.test.ts`

## Context

M3 shipped seven untraited waves and a `robots.json` with a single `basic` template. Playtest 3
found the run fun but too easy. GDD v0.7 answers that with the ladder, not invented HP on waves
1–7: one teaching trait on waves 4, 6 and 7; wave 5 stays `basic` (subtraction). Armor is
deferred to v1.1+.

Scenario files already exercise every trait (`:bb`, `:odd`, `:even`, `:w2`, `:w5`, `:w10` in
`sim/scenario/parse.ts`). This task does not change those codes.

## Requirements

1. **`robots.json`** — ship **exactly** these templates (ids and traits verbatim):

   | id | trait | isBoss |
   |---|---|---|
   | `basic` | `{ "type": "none" }` | false |
   | `weakness-2` | `{ "type": "weakness", "n": 2 }` | false |
   | `weakness-5` | `{ "type": "weakness", "n": 5 }` | false |
   | `weakness-10` | `{ "type": "weakness", "n": 10 }` | false |
   | `bounce-back` | `{ "type": "bounceBack" }` | false |
   | `odd-only` | `{ "type": "oddOnly" }` | false |
   | `even-only` | `{ "type": "evenOnly" }` | false |

   No `boss` template yet (task 26). Do not add visual keys — those are M5.

2. **Ladder swap** in `waves.json`. Keep every spawn's turn, lane letter, and HP range. Change
   **one** `robot` id per wave, as follows:

   | Wave | Which spawn | New `robot` | Why |
   |---|---|---|---|
   | 4 | first spawn in file order | `weakness-5` | First Weakness; `n = 5` (GDD v0.7 §18.2) |
   | 5 | — | unchanged (`basic`) | Teaches subtraction |
   | 6 | first spawn in file order | `bounce-back` | First Bounce-back |
   | 7 | first spawn in file order | `odd-only` | First Odd-only (base value 1 is odd) |

   Waves 1–3 unchanged.

3. **Tests** (shipped data, not fixtures of a parallel universe):
   - `robots.json` contains exactly the seven ids above, with those traits.
   - After `rollWave` of shipped wave-4/6/7, **at least one** pending spawn uses the teaching
     template; every other spawn on that wave is `basic`. Wave 5 is all `basic` for seeds 1–20.
   - Existing `tests/ladder.test.ts` still passes: sensible player wins seeds 1–100 above 40
     base HP; End-Turn-only loses. If traits make the sensible player lose or drop below 40,
     **stop and raise it** — do not silently raise HP or remove the trait.
   - A sim scenario (new file under `scenarios/`) that loads shipped wave 4, puts a `×5` in
     front of the Weakness-5 robot, and asserts `RobotDamaged.doubled === true` on the event
     list (gameplay change → event-list test, CLAUDE.md rule 2).

4. Record in Completion Notes: sensible-player min/median/max final base HP for seeds 1–100
   **before vs after** the swap (re-run the existing helper). That is the hardness evidence
   Playtest 3 asked for.

## Out of Scope

Trait silhouette / shield / chest-n (23). Procedural 8–9 (25). Boss (26). Settings (24). Armor.

## Acceptance Criteria

- [ ] `robots.json` has the seven templates above
- [ ] Waves 4/6/7 each have exactly one teaching-trait spawn; wave 5 and 1–3 unchanged
- [ ] Ladder balance tests still pass for seeds 1–100
- [ ] Scenario asserts doubled damage against shipped Weakness-5
- [ ] `npm test`, `typecheck`, `lint` pass
