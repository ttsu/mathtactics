# 25 — Shop 7–9 & Procedural Waves 8–9

**Milestone:** M4 · **Layer:** sim / data · **Depends on:** 22 · **Branch:** `task/25-procedural-waves-8-9`

## Task

Extend the run past wave 7: shop tables after waves 7–9, and procedural waves 8–9 rolled from
data tables. The run length becomes 9 until task 26 adds the Boss; **this task must add waves 8
and 9** so `waves.json` is 9 long and every non-final wave has a shop (schema already requires
that). Task 26 appends wave 10.

## References

- GDD v0.7 §0, §6.6, §10.2–10.3 · TR §6 (rolling a wave), §9 (procedural wave JSON)
- `sim/waves/rollWave.ts`, `sim/data/schemas.ts`, `data/shop.json`, `data/waves.json`
- Task 22's templates (`weakness-*`, `bounce-back`, `odd-only`, `even-only`, `basic`)

## Context

`rollWave` only understands authored `spawns`. Shop schema already demands
`{1 … waves.length − 1} ⊆ afterWave set`. Adding waves 8–9 without shops 7–8 will fail load;
adding wave 9 as last means shop after 9 is **not** required until task 26 adds wave 10 — so
**this task ships `afterWave` 7 and 8**, and **also ships `afterWave` 9** (allowed extra table
today; required once wave 10 exists). That way task 26 does not touch `shop.json`.

Playtest 3 asked for hardness. These waves are the stretch: mixed traits, up to 4 simultaneous
lanes, HP inside §6.6 (≤ 99). They are where a sensible player **loses most of the 20–50 HP**
between wave 7 (80–100 leftover) and the win (median 50–70, min near 40). A sloppy run can
lose here and never see the Boss; the sensible player still always reaches wave 10. Armor is
deferred to v1.1+.

## Requirements

1. **Schema.** A wave is **either** `{ id, spawns }` **or** `{ id, procedural }`, never both
   (strict). Procedural shape **exactly** TR §9. Cross-file: every `pool` id exists in
   `robots.json`. `count` 1–5; `hp` `1 ≤ min ≤ max ≤ 99`; `turn` values unique in the wave;
   at least one group with `turn: 1`; `pool` non-empty with unique ids; **`count` ≤ `pool.length`**
   (without replacement, grill B). Authored waves unchanged.

2. **`rollWave`** — if `procedural` is present, use the TR §9 draw order (normative). Authored
   path stays byte-identical (existing `tests/sim` rollWave tests must still pass). Procedural
   result is still `SpawnEntry[]` sorted by `turn`.

   Tests: same seed → same lanes, templates, HP; drawing from `shop` does not change a
   procedural wave; `count: 3` always yields 3 distinct lanes; a group never repeats a
   template; schema rejects `count` > `pool.length` and duplicate pool ids.

3. **Ship waves 8–9** (tune only with a recorded reason). Draft:

   | Wave | Groups | Teaches |
   |---|---|---|
   | 8 | T1 `count: 3` hp `[30, 50]` · T8 `count: 3` hp `[40, 65]` | Mix; 3+3 (grill A); Even-only at T1 (grill B) |
   | 9 | T1 `count: 4` hp `[45, 70]` · T8 `count: 4` hp `[60, 90]` · T15 `count: 3` hp `[70, 99]` | Four lanes **and** an extra pack (11 vs 6) |

   Pools (all include `basic`):
   - Wave 8 T1: `weakness-5`, `bounce-back`, `odd-only`, `even-only`, `basic`
   - Wave 8 T8: `weakness-2`, `weakness-10`, `even-only`, `bounce-back`, `basic`
   - Wave 9 all groups: `weakness-5`, `weakness-2`, `weakness-10`, `bounce-back`, `odd-only`, `even-only`, `basic`

   Constraints: ≥ 5 turn gap between groups; HP ≤ 99; wave 9 total **>** wave 8; `count` ≤ 4;
   wave 8 is 3+3 (grill A); Even-only is possible on wave 8 T1 (grill B).

4. **Shop tables** — append `afterWave` 7, 8, 9. Prices unchanged. Guarantees locked:
   after 7 `×2` or `×5` (grill A); after 8 none (grill A); after 9 `−N` (grill A). Table
   weights still draft (tune with reason):

   ```json
   { "afterWave": 7, "guarantees": [{ "kind": "mul", "n": [2, 5] }], "table": [
     { "kind": "add", "n": [1, 10], "weight": 4 },
     { "kind": "sub", "n": [1, 10], "weight": 5 },
     { "kind": "mul", "n": [2, 10], "weight": 5 }
   ]},
   { "afterWave": 8, "guarantees": [], "table": [
     { "kind": "add", "n": [1, 10], "weight": 4 },
     { "kind": "sub", "n": [1, 10], "weight": 5 },
     { "kind": "mul", "n": [2, 10], "weight": 5 }
   ]},
   { "afterWave": 9, "guarantees": [{ "kind": "sub" }], "table": [
     { "kind": "add", "n": [1, 10], "weight": 3 },
     { "kind": "sub", "n": [1, 10], "weight": 6 },
     { "kind": "mul", "n": [2, 10], "weight": 5 }
   ]}
   ```

   After-wave 9 exists so task 26 can append the Boss without a shop PR. Schema already
   allows extra tables.

5. **Scenarios:** at least one procedural-wave scenario (`mode: run`, inline `waves:` with a
   tiny `procedural` group) asserting spawn count, distinct lanes, and a traited
   `RobotSpawned`. Gameplay change → event list (CLAUDE.md rule 2).

6. **Ladder tests:** extend `tests/ladder.test.ts` to the new `waves.json` length. Sensible
   player still wins seeds 1–100. On this 9-wave run (no Boss yet), leftover should already
   sit near the 10-wave target — **min ≥ 40**, **median 50–70** — because the Boss wave is
   not a chip source. End-Turn-only still loses. If the draft numbers break that, retune
   **waves 8–9 only** (not 1–7) and record why.

## Out of Scope

Boss (26). Trait visuals (23). Armor. Retuning waves 1–7.

## Acceptance Criteria

- [ ] `rollWave` supports procedural groups; authored path unchanged
- [ ] Waves 8–9 ship as procedural tables; shops 7–9 exist
- [ ] Schema rejects a wave with both `spawns` and `procedural`
- [ ] Ladder tests pass for seeds 1–100 on the 9-wave run (leftover min ≥ 40, median 50–70)
- [ ] `npm test`, `typecheck`, `lint`, `npm run sim -- scenarios` pass
