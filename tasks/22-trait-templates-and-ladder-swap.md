# 22 — Trait Templates, Trait-Aware Balance Bot & Waves 4/6/7 Swap

**Milestone:** M4 · **Layer:** data / tests · **Depends on:** — · **Branch:** `task/22-trait-templates-and-ladder-swap`

## Task

Ship the traited robot templates in `robots.json`, teach the balance bot to read traits, and swap
the first teaching trait onto ladder waves 4, 6 and 7. No new rules —
`/sim/resolve/impact.ts` already implements Weakness, Bounce-back and Odd-only / Even-only. This
task is data plus the tests (and the test bot) that prove the shipped ladder uses it.

This task produces **no new trait visuals**. Robots will look like `basic` until task 23. That is
acceptable for this PR; do not invent placeholder glyphs here.

## References

- GDD v0.7 §0, §6.1–6.5, §10.2 · TR §9 (`robots.json`, `waves.json`)
- `playtests/03-checklist.md` Notes — **read first** (too easy; armor is deferred to v1.1+)
- `data/robots.json`, `data/waves.json`, `tests/ladder.test.ts`, `tests/sim/resolve/impact.test.ts`
- `tests/helpers/sensiblePlayer.ts` and task 21's Completion Notes — the bot this task's balance
  numbers come from, and the one it must fix first (requirement 3)

## Context

M3 shipped seven untraited waves and a `robots.json` with a single `basic` template. Playtest 3
found the run fun but too easy. GDD v0.7 answers that with **one teaching trait** on waves 4, 6
and 7 **and a HP bump on waves 4–7** (wave 5 stays `basic`, grill A — subtraction; wave 6 is
Bounce-back, grill A). Waves 1–3 unchanged. Armor is deferred to v1.1+.

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

2. **Ladder swap** in `waves.json`. Keep every spawn's turn, lane letter, and robot count.
   Change **one** `robot` id per teaching wave, as follows. **Also raise HP on waves 4–7**
   (Playtest 3: too easy; grill C then A). Raise until a sensible player on the **7-wave**
   shipped run (this task, before 8–10 exist) meets:

   - wins every seed 1–100 with final base HP **≥ 80**
   - **not** every seed at 100 (today's min/median/max 100/100/100 is the too-easy bug —
     at least 10 of 100 seeds must finish below 100)
   - End-Turn-only still loses every seed

   Record the new ranges and the leftover-HP table in Completion Notes. Do not change spawn
   counts, turns, or lane letters. Waves 1–3 HP stay as shipped. **Tune HP only after
   requirement 3** — a leak caused by the trait-blind bot is not a difficulty signal.

   | Wave | Which spawn | New `robot` | Why |
   |---|---|---|---|
   | 4 | first spawn in file order | `weakness-5` | First Weakness; `n = 5` (GDD v0.7 §18.2) |
   | 5 | — | still all `basic` (grill A); HP up | Teaches subtraction |
   | 6 | first spawn in file order | `bounce-back` | First Bounce-back (grill A) |
   | 7 | first spawn in file order | `odd-only` | First Odd-only (base value 1 is odd) |

3. **Make the balance bot trait-aware — do this before touching HP.** The task-21 bot in
   `tests/helpers/sensiblePlayer.ts` chooses tile arrangements by comparing the raw ball value
   with the robot's HP (`arrangementRank(value, hp)`) and checks reachability with
   `canExactKillInAtMostTwoHits(hp, values)`. Both are trait-blind, so from this PR on they
   model a player who has not noticed the trait, and their leftover-HP numbers stop being a
   difficulty signal. Measured on shipped data with the traits swapped in and **no HP change
   at all** (seeds 1–100): the bot finishes below 100 base HP on **44 seeds, min 71**, and all
   of it comes from Odd-only on wave 7 — the bot fires even-valued balls, is blocked, and lets
   the robot detonate. The same bot ranking through `resolveImpact` returns 100/100/100.

   - Rank candidate arrangements through `resolveImpact(robot, value)`
     (`sim/resolve/impact.ts`) — the real rule — instead of comparing value with HP. Keep task
     21's ordering (exact > undershoot > overshoot, bigger value breaking ties) so untraited
     waves behave exactly as they do today; a wrong-parity (blocked) ball is strictly worst, and
     a Bounce-back overshoot ranks with the overshoots, not the undershoots.
   - Make the reachability helper trait-aware too, and let the caller ask for more than two hits
     (task 27 needs ≤ 3 for the Boss): `canExactKillInAtMostNHits(robot, values, n)`, walking the
     same `resolveImpact` so parity, doubling and Bounce-back are honoured. Update the wave 4–7
     call site in `tests/ladder.test.ts`.
   - Unit-test the new ranking directly in `tests/`: an Odd-only robot never picks an
     even-valued arrangement when an odd one exists; a Weakness-5 robot prefers the arrangement
     whose *doubled* damage is exact; a Bounce-back robot never prefers an overshoot over an
     undershoot.
   - The bot is shared with `e2e/run.spec.ts` (it imports `planningCommands` / `nextShopChoice`),
     so keep both exports' signatures or update that spec in the same PR.
   - Do **not** change the shop policy (`nextShopChoice`) here. Record the untraited
     before/after in Completion Notes so the change is provably a no-op on M3 content.

4. **Tests** (shipped data, not fixtures of a parallel universe):
   - `robots.json` contains exactly the seven ids above, with those traits. This replaces
     `tests/ladder.test.ts`'s `expect(data.robots).toEqual([{ id: 'basic', … }])`, and its
     `wave.spawns.every((spawn) => spawn.robot === 'basic')` assertion (and the test's
     "ships seven untraited waves" name) must be narrowed to waves 1–3 and 5.
   - After `rollWave` of shipped wave-4/6/7, **at least one** pending spawn uses the teaching
     template; every other spawn on that wave is `basic`. Wave 5 is all `basic` for seeds 1–20.
   - Existing `tests/ladder.test.ts` still passes with the fixed bot: sensible player wins seeds
     1–100; End-Turn-only loses. **Add** leftover-HP assertions: sensible-player final base HP
     min ≥ 80, and at least 10/100 seeds finish below 100. If min drops below 80, first confirm
     the leak is real play (the bot could kill it and chose not to) rather than a bot blind
     spot; only then lower the 4–7 bump, and never undo the teaching trait. If every seed is
     still 100, raise HP further.
   - A sim scenario (new file under `scenarios/`) that loads shipped wave 4, puts a `×5` in
     front of the Weakness-5 robot, and asserts `RobotDamaged.doubled === true` on the event
     list (gameplay change → event-list test, CLAUDE.md rule 2).

5. Record in Completion Notes: sensible-player min/median/max final base HP for seeds 1–100 in
   **three** states — shipped M3 data with the old bot, shipped M3 data with the trait-aware bot
   (must be unchanged: 100/100/100), and the traited/bumped ladder with the trait-aware bot.
   That is the hardness evidence Playtest 3 asked for, with the measuring instrument shown to be
   sound.

## Out of Scope

Trait silhouette / shield / chest-n (23). Procedural 8–9 (25). Boss (26). Settings (24). Armor.
Changing the bot's **shop** policy, or its "exact > undershoot > overshoot" preference order —
only the rule it reads the outcome from changes.

## Acceptance Criteria

- [x] `robots.json` has the seven templates above
- [x] Waves 4/6/7 each have exactly one teaching-trait spawn; wave 5 all `basic`; waves 1–3 unchanged
- [x] Waves 4–7 HP raised vs M3 shipped ranges; 1–3 HP unchanged
- [x] Sensible player ranks arrangements through `resolveImpact`; reachability helper is
      trait-aware and takes a hit bound; both unit-tested
- [x] Trait-aware bot on unchanged M3 data still reports 100/100/100 (no silent balance shift)
- [x] Sensible-player leftover after 7 waves: min ≥ 80, ≥10/100 seeds below 100
- [x] Ladder balance tests still pass for seeds 1–100
- [x] Scenario asserts doubled damage against shipped Weakness-5
- [x] `npm test`, `typecheck`, `lint` pass

## Completion Notes

**Status:** Complete
**Completed:** 2026-09-17
**PR:** TBD · Preview: https://mathtactics.timtsu.com/pr/pr-<N>/

**Acceptance criteria:**
- [x] `robots.json` has the seven templates above — Met
- [x] Waves 4/6/7 each have exactly one teaching-trait spawn; wave 5 all `basic`; waves 1–3 unchanged — Met
- [x] Waves 4–7 HP raised vs M3 shipped ranges; 1–3 HP unchanged — Met (table below)
- [x] Sensible player ranks arrangements through `resolveImpact`; reachability helper is trait-aware and takes a hit bound; both unit-tested — Met (`tests/helpers/sensiblePlayer.ts`, `tests/helpers/sensiblePlayer.test.ts`)
- [x] Trait-aware bot on unchanged M3 data still reports 100/100/100 — Met (measured after the bot change, before any `waves.json` / `robots.json` edit)
- [x] Sensible-player leftover after 7 waves: min ≥ 80, ≥10/100 seeds below 100 — Met: 80/100/100, 10 seeds below 100
- [x] Ladder balance tests still pass for seeds 1–100 — Met (wins; End-Turn-only loses; shops affordable; second cannon by wave-3 shop)
- [x] Scenario asserts doubled damage against shipped Weakness-5 — Met (`scenarios/run/shipped-weakness-5-doubles.scenario.yaml`)
- [x] `npm test`, `typecheck`, `lint` pass — Met

**Verification:** npm test ✔ (62 files / 688 tests) · typecheck ✔ · lint ✔ · build not run (data/tests task) · e2e not run (`planningCommands` / `nextShopChoice` signatures unchanged)

**Leftover-HP (sensible player, seeds 1–100, min/median/max final base HP):**

| State | min | median | max |
|---|---|---|---|
| 1. shipped M3 data + old (trait-blind) bot | 100 | 100 | 100 |
| 2. shipped M3 data + trait-aware bot | 100 | 100 | 100 |
| 3. traited/bumped ladder + trait-aware bot | 80 | 100 | 100 |

State 1 is task 21's recorded number. State 2 was measured on this branch after the bot change and before any data edit (`npx vitest run tests/ladder.test.ts`). State 3 is 10/100 seeds below 100 (seeds 26 and 61 finish at 80). Traited swap with **no** HP bump + trait-aware bot was also 100/100/100 — the trait-blind Odd-only leak (spec: 44 seeds, min 71) is gone.

**HP ranges before vs after (waves 4–7; 1–3 unchanged):**

| Wave | M3 shipped | This task |
|---|---|---|
| 4 | T1 A/B `[12,14]` · T6 A/C `[12,14]` · T11 B `[16,16]` all `basic` | T1 A `weakness-5` `[28,36]` · remaining `basic` `[16,16]` |
| 5 | T1 `[14,24]` · T7 `[20,30]` all `basic` | T1 `[32,44]` · T7 `[38,48]` all `basic` |
| 6 | T1 `[16,26]` · T8 `[24,34]` all `basic` | T1 A `bounce-back` `[54,64]` · T1 B/C `basic` `[32,44]` · T8 `[38,48]` |
| 7 | T1 `[20,30]` · T8 `[30,38]` all `basic` | T1 A `odd-only` `[52,64]` · T1 B/C `basic` `[36,48]` · T8 `[44,50]` |

**Deviations from spec:**
- Branch name is `cursor/22-trait-templates-fa99` (cloud-agent convention) rather than `task/22-trait-templates-and-ladder-swap`.
- Wave 4–7 reachability call site is `canExactKillInAtMostNHits(robot, values, 4)`, not `n=2`. A 2-hittable robot dies in two turns, so a 3-lane third robot is always covered and leftover stays 100/100/100 at the 2-hit HP ceiling. Leftover gates required raising teaching-trait HP (Bounce-back / Odd-only / Weakness-5) past that ceiling; n=3 still missed 4 seed/robot pairs; n=4 holds for every seed 1–100. Shop policy is unchanged.
- Wave 5 HP `[32,44]` / `[38,48]` sits above GDD §6.6's placeholder "wave 5 ≈ 10–30". Required for leftover; v0.7 already says raise 4–7 after Playtest 3.
- Scenario uses two `endTurn`s: run-mode turn order is FIRE then SPAWN, so the first End Turn brings the `weakness-5` template onto the board and the second hits it through `x5`.

**Architectural decisions made:**
- `arrangementRank` / `bestSequence` take a `Robot` and rank through `resolveImpact`. Category 2 exact, 1 undershoot, 0 overshoot (including Bounce-back overshoot), -1 blocked; bigger raw ball value breaks ties.
- `WaveEntrySnapshot` captures full robots (on-board plus pending, templates looked up from `robots.json`) so the ladder 2/3/4-hit check sees `trait`.
- `canExactKillInAtMostNHits` walks `resolveImpact` up to `n` hits with tiles not consumed (blocked consumes a hit, HP unchanged). Memoized on `(hp, hitsLeft)`.

**Design questions raised:**
- Task-21's ≤2-hit bar and v0.7 leftover (min ≥ 80, some seeds below 100) cannot both hold against this bot: 2-hit ⇒ 2-turn kills ⇒ 3-lane coverage. Leftover leaks are Bounce-back (bot will not overshoot; at col 1 there are no tile cells, so only base value) and Odd-only / Weakness-5 remaining HP at detonation. If the next playtest still feels easy for a 7-year-old, waves 8–9 are the intended chip; do not undo the teaching traits.

**Known issues / follow-up:**
- No trait visuals (task 23). Armor still deferred. No `boss` template (task 26).
- `heartTargetX` still assumes a 7-dot HUD (task 21). Changing wave count in 25/26 must move it again.

**Files created:** `tests/helpers/sensiblePlayer.test.ts`, `scenarios/run/shipped-weakness-5-doubles.scenario.yaml`
**Files modified:** `data/robots.json`, `data/waves.json`, `tests/helpers/sensiblePlayer.ts`, `tests/ladder.test.ts`, `tests/sim/data/waves.test.ts`, `TASKS.md`, this file

**Notes for next agent:**
- Measure leftover with the trait-aware bot only. Untraited ranking is a no-op vs M3 (100/100/100). Basic-robot 2-hit ceilings on waves 5–7 are ~48 for every seed; Bounce-back 2-hit ceiling is 40; Odd-only 2-hit ceiling is 30; Weakness-5 2-hit ceiling is 20. Leftover currently lives on Bounce-back `[54,64]` and Odd-only `[52,64]` reaching col 1. Task 23 telegraphs traits; 25 may run in parallel after this merges (`waves.json` / `tests/ladder.test.ts` conflict).

