# 26 — Wave 10 Boss

**Milestone:** M4 · **Layer:** data / presentation · **Depends on:** 22 · **Branch:** `task/26-wave-10-boss`

## Task

Author wave 10: one Boss (100–150 HP, no trait, oversized sprite) plus a light `basic` escort.
Clearing it wins the run. Shop after wave 9 already ships in task 25.

## References

- GDD §6.6, §10.1–10.2, §11.2 · TR §9 (`robots.json`, spawn HP cap)
- `game/board/views/RobotView.ts`, `data/waves.json`, `sim/data/schemas.ts` (`MAX_SPAWN_HP`)
- Task 22 templates; task 25 shops 7–9 and waves 8–9

## Context

Normal robots cap at 99 HP so two digits always fit. The Boss is the only three-digit HP
(GDD §2.1, §6.6). `RobotView.showHpText` already shrinks three-digit text to fit the block —
keep that; the sprite **overflows the cell**, the number stays inside.

`MAX_SPAWN_HP = 99` in `sim/data/schemas.ts` will reject a 100–150 range. Exception: a spawn
whose `robot` template has `isBoss: true` may use `max ≤ 150`. Procedural pools must not
contain the Boss (schema: `isBoss` templates illegal in `procedural.pool`).

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

The Boss detonates for remaining HP like any robot — leaking it is a loss, not a chip
   (grill A). Escort stays light so a sensible player who is aiming at the Boss does not
   get bled by extras. No shop after wave 10 (it is last).

4. **Oversized sprite** — `presentation.json` `boss.scale` (e.g. `1.55`). `RobotView` (or
   reconcile) applies it when `robot.isBoss`. The sprite may overflow into neighbouring
   cells; it still **occupies one cell** for collision, tiles, and advance. HP numeral
   stays inside the original block size (already shrinks). Do not let the sprite cover
   the cannon slot (col 0) at spawn (col 7) — overflow downward/upward/right is fine;
   left overflow at col 7 is the board edge and is fine.

5. **Tests / scenarios:**
   - Rolling shipped wave 10, seeds 1–20: exactly one `isBoss` spawn, HP in 100–150, lane 2;
     escort is `basic` and ≤ 99 HP.
   - A scenario with a Boss at 100 HP, ball value 100, asserts `RobotDefeated` `exact: true`
     and `RunWon` when it was the last robot of the last wave.
   - Schema fixture: `basic` hp `[100, 100]` fails; `boss` hp `[100, 150]` loads.

6. **HUD** — wave dots already use `waves.length` (10). Check on an iPad-width screenshot or
   e2e bounding boxes that 10 dots still fit the HUD bar and that detonation
   `heartTargetX` still lands on ♥ (task 21 used 397 for a 7-dot layout). Adjust
   `presentation.json` `detonate.heartTargetX` **only if** the ♥ moved; record the new value.

## Out of Scope

Armor. Trait chrome (23) — Boss is untraited. Procedural tables (25). Balance across 10
waves (27).

## Acceptance Criteria

- [ ] `boss` template exists; wave 10 is authored last
- [ ] Boss HP 100–150; escort ≤ 99; schema enforces the split
- [ ] Boss sprite overflows the cell; HP stays the largest readable numeral
- [ ] Exact-kill scenario on the Boss wins the run
- [ ] `npm test`, `typecheck`, `lint` pass
