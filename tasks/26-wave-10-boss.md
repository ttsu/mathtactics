# 26 — Wave 10 Boss

**Milestone:** M4 · **Layer:** data / presentation · **Depends on:** 22, 23, 25 · **Branch:** `task/26-wave-10-boss`

> Dependencies are hard, not advisory. **25** must land first: appending wave 10 makes wave 9 a
> non-final wave, and the schema requires a shop table for every non-final wave, so without task
> 25's `afterWave: 9` the data file fails to load and nothing runs. **23** owns the `RobotView`
> chrome seam this task's oversized sprite hangs off (see requirement 4).

## Task

Author wave 10: one Boss (**100–150 HP**, range grill A, **no trait**, grill A, oversized sprite) plus a light `basic` escort.
Clearing it wins the run. Shop after wave 9 already ships in task 25.

## References

- GDD §6.6, §10.1–10.2, §11.2 · TR §9 (`robots.json`, spawn HP cap)
- `game/board/views/RobotView.ts`, `data/waves.json`, `sim/data/schemas.ts` (`MAX_SPAWN_HP`)
- Task 22 templates; task 25 shops 7–9 and waves 8–9

## Context

Normal robots cap at 99 HP so two digits always fit. The Boss is the only three-digit HP
(GDD §2.1, §6.6) and it is **untraited** (grill A) — the number is the puzzle, not a shield
or parity gate. Exact-killable in ≤ 3 hits on entering wave 10 (grill A; asserted in task 27).
`RobotView.showHpText` already shrinks three-digit text to fit the block — keep that; the
sprite **overflows the cell**, the number stays inside.

`MAX_SPAWN_HP = 99` in `sim/data/schemas.ts` will reject a 100–150 range. Exception: a spawn
whose `robot` template has `isBoss: true` may use `max ≤ 150`. Procedural pools must not
contain the Boss (schema: `isBoss` templates illegal in `procedural.pool`).

That exception cannot live where the bound lives today. `SpawnHpSchema` validates one spawn in
isolation and never sees `robots.json`; the template lookup only happens in `GameDataSchema`'s
cross-file `superRefine`. So it is a two-stage change: raise the per-spawn ceiling to the Boss
maximum (150) with the usual `1 ≤ min ≤ max` check, and enforce **≤ 99 unless the named template
is `isBoss`** in the cross-file pass, where the error path is already `waves.json: waves[i]
.spawns[j].hp`. One consequence to state in Completion Notes: `WavesFileSchema` is also used
standalone for the scenario `waves:` override (TR §12), which runs no cross-file checks, so a
scenario — and only a scenario — can write a 150 HP `basic`.

## Requirements

1. **`robots.json`** — add:

   ```json
   { "id": "boss", "trait": { "type": "none" }, "isBoss": true }
   ```

   Update task 22's "exactly seven templates" assertion to eight (the seven plus `boss`).

2. **Schema** — authored `hp` max is 99 unless the named template is `isBoss`, then 150.
   Cross-file check. A `basic` spawn with `[100, 120]` still fails. Boss `trait` must be
   `none` (schema). Procedural `pool` rejects `isBoss` ids.

3. **Wave 10** — authored, last in `waves.json`. Draft (tune with recorded reason):

   | Turn | Lane | robot | hp |
   |---|---|---|---|
   | 1 | `2` (fixed center) | `boss` | `[100, 150]` |
   | 1 | `A` | `basic` | `[20, 40]` |
   | 7 | `B` | `basic` | `[30, 50]` |
   | 7 | `C` | `basic` | `[30, 50]` |

   Locked (grill B). The T7 pair is a kid-facing trap if he only stares at the Boss. A
   sensible player kills them, so they must not be what drops leftover HP into the 40–70
   band — that remains waves 8–9. The Boss detonates for remaining HP; leaking it is a
   loss. No shop after wave 10.

4. **Oversized sprite** — `presentation.json` `boss.scale` (e.g. `1.55`), applied when
   `robot.isBoss` through **task 23's `RobotView` chrome entry point**, so the Boss is set up
   from the same two creation sites as every other robot (`BoardRenderer.syncRobots` and
   `ensureRobotView`, the latter reached from `SegmentPlayer`'s spawn beat, whose `RobotSpawned`
   event already carries `isBoss`). Do not add a third path. The sprite may overflow into
   neighbouring cells; it still **occupies one cell** for collision, tiles, and advance. HP
   numeral stays inside the original block size (already shrinks). Do not let the sprite cover
   the cannon slot (col 0) at spawn (col 7) — overflow downward/upward/right is fine;
   left overflow at col 7 is the board edge and is fine.

5. **Tests / scenarios:**
   - Rolling shipped wave 10, seeds 1–20: exactly one `isBoss` spawn, HP in 100–150, lane 2;
     escort is `basic` and ≤ 99 HP.
   - A scenario with a Boss at 100 HP, ball value 100, asserts `RobotDefeated` `exact: true`
     and `RunWon` when it was the last robot of the last wave.
   - Schema fixture: `basic` hp `[100, 100]` fails; `boss` hp `[100, 150]` loads; a `procedural`
     pool naming `boss` fails.
   - Task 22's `robots.json` "exactly seven templates" assertion becomes eight, and the shipped
     wave-id lists in `tests/ladder.test.ts` / `tests/sim/data/waves.test.ts` gain `wave-10`.

6. **Run length changes from 9 to 10 — same fallout list as task 25 requirement 7.** Wave dots
   come from `waves.length`, so check on an iPad-width screenshot or e2e bounding boxes that 10
   dots still fit the HUD bar and that detonation `heartTargetX` still lands on ♥ (task 21 used
   397 for 7 dots; task 25 re-measured it for 9). Adjust `presentation.json`
   `playback.detonate.heartTargetX` **only if** the ♥ moved; record the new value.
   `e2e/run.spec.ts`'s end-of-run assertion moves to `waveIndex === 9`; task 27 then rewrites
   that spec properly, but it must pass here.

## Out of Scope

Armor. Trait chrome (23) — Boss is untraited, and this task reuses 23's seam rather than
extending it. Procedural tables (25). Balance across 10 waves (27).

## Acceptance Criteria

- [x] `boss` template exists; wave 10 is authored last
- [x] Boss HP 100–150; escort ≤ 99; schema enforces the split across the two validation stages
- [x] `procedural.pool` rejects `isBoss` ids
- [x] Boss sprite overflows the cell via task 23's chrome entry point; HP stays the largest
      readable numeral
- [x] Exact-kill scenario on the Boss wins the run
- [x] 10-wave fallout handled: wave dots fit, `heartTargetX` verified, run e2e updated
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass
- [ ] iPad preview check (Boss scale and 10 dots) — awaiting human

## Completion Notes

**Status:** Complete (iPad check pending)
**Completed:** 2026-09-17
**PR:** TBD · Branch: `cursor/26-wave-10-boss-fa99`

**Acceptance criteria:**
- [x] `boss` template exists; wave 10 is authored last — Met
- [x] Boss HP 100–150; escort ≤ 99; schema enforces the split across the two validation stages — Met
- [x] `procedural.pool` rejects `isBoss` ids — Met (existing titan fixture plus shipped `boss` id)
- [x] Boss sprite overflows the cell via task 23's chrome entry point; HP stays the largest readable numeral — Met (`RobotView.setChrome` redraws the silhouette at `boss.scale`; screenshot `/opt/cursor/artifacts/26-boss.png`; iPad still pending)
- [x] Exact-kill scenario on the Boss wins the run — Met (`scenarios/run/boss-exact-kill-wins.scenario.yaml`)
- [x] 10-wave fallout handled: wave dots fit, `heartTargetX` verified, run e2e updated — Met (`e2e/run.spec.ts` waveIndex 9 / 10 dots; `heartTargetX` 449 → 475, e2e within 6 pt)
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass — Met
- [ ] iPad preview check (Boss scale and 10 dots) — awaiting human check on preview

**Verification:** npm test ✔ (63 files / 724 tests) · typecheck ✔ · lint ✔ · build ✔ · e2e ✔ (75 tests, webkit) · `npm run sim -- scenarios/run/boss-exact-kill-wins.scenario.yaml` ✔

**Deviations from spec:**
- Branch name is `cursor/26-wave-10-boss-fa99` (cloud-agent convention) rather than `task/26-wave-10-boss`.
- `heartTargetX` 449 → **475** (one extra 16 pt dot + 10 pt gap). e2e `run-playback` still within 6 pt. 10 dots still fit the HUD bar.
- Wave 10 HP is the draft `[100, 150]` / escort `[20, 40]` + `[30, 50]` — not retuned.
- 10-wave leftover is still Partial from task 25: sensible-player seeds 1–100 **min 56 / median 99 / max 100**. Escort did not move leftover (wave 10 turns min/median/max 2/3/6). Did not grind 8–9 HP.
- End-Turns min/median/max **50/66/93** (task 25 was 48/63/87). `MAX_TURNS = 200` still has headroom. Task 27 remeasures.
- Boss overflow is drawn at scaled size inside `paintBody`, not `Graphics.setScale`. Same seam (`setChrome` only); Container scale stays 1.

**Architectural decisions made:**
- Two-stage HP: per-spawn authored ceiling 150; `GameDataSchema` cross-file enforces ≤ 99 unless the named template is `isBoss` (error path `waves.json: waves[i].spawns[j].hp`). Procedural groups keep a separate ≤ 99 schema (they already reject `isBoss` pool ids).
- `WavesFileSchema` standalone (scenario `waves:`) has no cross-file check, so a scenario can write 150 HP `basic`.
- Boss `trait` must be `none` (robots.json schema).
- `RobotView.setChrome` stores `bodyScale` and redraws the silhouette (antennae included) at `ROBOT_SIZE * boss.scale`. HP text + bar stay in the original `ROBOT_SIZE` box; `showHpText` still shrinks three-digit HP. No third creation path: waiters pass `isBoss: false`; Boss arrives via `RobotSpawned` and `syncRobots`.

**Design questions raised:**
- None. Leftover median 99 is still task 25/27's problem.

**Known issues / follow-up:**
- Task 27: leftover still Partial from 25 (min 56 / median 99 on 10 waves). Boss exact-kill in ≤ 3 hits is their assertion (`canExactKillInAtMostNHits(..., 3)` exact-only). Scale the silhouette inside `setChrome`, not the Container. `heartTargetX` is 475 for 10 dots.
- iPad preview check still required before merge (Boss scale and 10 dots).

**Files created:** `scenarios/run/boss-exact-kill-wins.scenario.yaml`, `e2e/boss.spec.ts`
**Files modified:** `data/{robots,waves,presentation}.json`, `sim/data/schemas.ts`, `game/board/views/RobotView.ts`, `game/board/BoardRenderer.ts`, `tests/helpers/playbackSettings.ts`, `tests/ladder.test.ts`, `tests/sim/data/{waves,load,shop,levels}.test.ts`, `tests/sim/commands/{fixtures.ts,loadLevel.test.ts}`, `tests/game/{store,testHandle}.test.ts`, `e2e/run.spec.ts`, `TASKS.md`, this file

**Notes for next agent:**
- Leftover is still Partial from 25; do not retune waves 8–9 here. Wave 10 escort is a kid-facing trap, not the leftover lever. `setChrome` is the only Boss scale site — playback/`place` already `setScale(1)` on the Container. Start leftover from min 56 / median 99, not from 50–70.
