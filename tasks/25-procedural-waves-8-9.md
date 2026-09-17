# 25 — Shop 7–9 & Procedural Waves 8–9

**Milestone:** M4 · **Layer:** sim / data · **Depends on:** 22 · **Branch:** `task/25-procedural-waves-8-9`

## Task

Extend the run past wave 7: shop tables after waves 7–9, and procedural waves 8–9 rolled from
data tables. The run length becomes 9 until task 26 adds the Boss; **this task must add waves 8
and 9** so `waves.json` is 9 long and every non-final wave has a shop (schema already requires
that). Task 26 appends wave 10.

## References

- GDD v0.7 §0, §6.6, §10.2–10.3 · TR §6 (rolling a wave), §9 (procedural wave JSON, `rollShop`
  guarantee matching)
- `sim/waves/rollWave.ts`, `sim/data/schemas.ts`, `data/shop.json`, `data/waves.json`
- Task 22's templates (`weakness-*`, `bounce-back`, `odd-only`, `even-only`, `basic`) **and its
  trait-aware balance bot** — requirement 6's numbers are meaningless without it
- `sim/scenario/parse.ts` (`WavesFileSchema` backs the scenario `waves:` override)

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
   `robots.json`. `count` 1–5 (the *schema* bound; the shipped tables in requirement 3 stay at
   ≤ 4); `hp` `1 ≤ min ≤ max ≤ 99`; `turn` values unique in the wave; at least one group with
   `turn: 1`; `pool` non-empty with unique ids; **`count` ≤ `pool.length`** (without
   replacement, grill B). Authored waves unchanged.

   `WaveDef` becomes a **union**, so every reader has to narrow. Current `wave.spawns` readers:
   `sim/waves/rollWave.ts`, `tests/ladder.test.ts` (the shipped-wave shape test),
   `tests/sim/data/waves.test.ts`, `tests/sim/waves/rollWave.test.ts`. Prefer a discriminated
   union (`'spawns' in wave`) over optional fields so `tsc` finds every site. The scenario
   `waves:` override reuses `WavesFileSchema` (`sim/scenario/parse.ts`), so inline procedural
   waves come along for free — requirement 5 depends on that; add a parser test for it.

2. **`rollWave`** — if `procedural` is present, use the TR §9 draw order (normative). Authored
   path stays byte-identical (existing `tests/sim` rollWave tests must still pass). Procedural
   result is still `SpawnEntry[]` sorted by `turn`.

   Tests: same seed → same lanes, templates, HP; drawing from `shop` does not change a
   procedural wave; `count: 3` always yields 3 distinct lanes; a group never repeats a
   template; schema rejects `count` > `pool.length` and duplicate pool ids; a wave with both
   `spawns` and `procedural` is rejected.

3. **Ship waves 8–9** (tune only with a recorded reason). Draft:

   | Wave | Groups | Teaches |
   |---|---|---|
   | 8 | T1 `count: 3` hp `[30, 50]` · T8 `count: 3` hp `[40, 65]` | Mix; 3+3 (grill A); split pools (grill A); Even-only at T1 (grill B) |
   | 9 | T1 `count: 4` hp `[45, 70]` · T8 `count: 4` hp `[60, 90]` · T15 `count: 3` hp `[70, 99]` | Four lanes **and** an extra pack (11 vs 6); full mix (grill A) |

   Wave 8 pools locked (grill A). Wave 9 full mix locked (grill A); HP bands still draft:
   - Wave 8 T1: `weakness-5`, `bounce-back`, `odd-only`, `even-only`, `basic`
   - Wave 8 T8: `weakness-2`, `weakness-10`, `even-only`, `bounce-back`, `basic`
   - Wave 9 all groups: `weakness-5`, `weakness-2`, `weakness-10`, `bounce-back`, `odd-only`, `even-only`, `basic`

   Constraints: ≥ 5 turn gap between groups; HP ≤ 99; wave 9 total **>** wave 8; `count` ≤ 4;
   wave 8 is 3+3 (grill A); Even-only is possible on wave 8 T1 (grill B); wave 8 pools are
   split (grill A); wave 9 is one shared full mix (grill A).

4. **Shop tables** — append `afterWave` 7, 8, 9. Prices unchanged. Guarantees locked:
   after 7 `×2` or `×5` (grill A); after 8 none (grill A); after 9 `−N` (grill A). Table
   weights still draft (tune with reason):

   **Read the guarantee semantics before copying the JSON below.** `{ kind: 'mul', n: [2, 5] }`
   is a *range*, not a set: `rollShop` picks a weighted table entry of that kind and then draws
   `nextInt` over the intersection of the two ranges (TR §9), so `[2, 5]` can also produce `×3`
   or `×4`. That is a legible, cheap multiply either way, so **ship the range** and note it in
   Completion Notes. A literal "`×2` or `×5`, nothing between" would need a new set-valued
   guarantee shape in `shop.json` — out of scope here; it is listed in GDD §18 Open Items for
   the human to settle.

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

   Use task 22's **trait-aware** bot. A parity-blind bot leaks on every Odd-only/Even-only
   robot it meets, and waves 8–9 are full of them — tuning HP down to compensate would ship
   the Playtest 3 complaint back. If task 22 has not landed yet, land it first; this task's
   numbers depend on it.

   Aim at the band, not at its centre: wave 10 adds an escort, so task 27 re-measures the same
   numbers with the Boss in and may nudge 8–9 again. Leave the tuning rationale in Completion
   Notes so 27 adjusts rather than re-derives.

7. **Run length changes from 7 to 9 — the rest of the app follows.** These fail (or silently
   drift) the moment `waves.json` grows, and CI must be green in this PR:
   - `e2e/run.spec.ts` asserts `finalState?.waveIndex === 6` and is titled "7 waves"; the
     sensible-player turn budget (`MAX_TURNS = 200`, measured max 51 for 7 waves) needs
     headroom over the new measured max. Task 27 rewrites this spec for 10 waves; here, just
     keep it passing.
   - The HUD wave dots come from `waves.json` length (`game/ui/Hud.tsx`), so the ♥ shifts.
     `presentation.json` `playback.detonate.heartTargetX` is the Phaser fly-to target for
     detonations (task 21 moved it 295 → 397 when the row went from 3 dots to 7) and
     `e2e/run-playback.spec.ts` asserts the drawn ♥ is within 6 pt of it. Re-measure and record
     the new value, and check 9 dots still fit the bar.
   - `tests/ladder.test.ts` and `tests/sim/data/waves.test.ts` both assert the shipped wave-id
     list; both need the two new ids and the union narrowing from requirement 1.
   - Shop coverage (`{1 … waves.length − 1} ⊆ afterWave`) is why requirement 4 ships three
     tables at once; `afterWave: 9` is the extra one that makes task 26 a no-shop-change PR.

## Out of Scope

Boss (26). Trait visuals (23). Armor. Retuning waves 1–7. A set-valued shop guarantee.

## Acceptance Criteria

- [ ] `rollWave` supports procedural groups; authored path unchanged
- [ ] Waves 8–9 ship as procedural tables; shops 7–9 exist
- [ ] Schema rejects a wave with both `spawns` and `procedural`
- [ ] Scenario `waves:` accepts an inline procedural wave
- [ ] Ladder tests pass for seeds 1–100 on the 9-wave run with the trait-aware bot
      (leftover min ≥ 40, median 50–70)
- [ ] 9-wave fallout handled: run e2e, wave dots, `heartTargetX`, shipped-wave-id assertions
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e`, `npm run sim -- scenarios` pass
