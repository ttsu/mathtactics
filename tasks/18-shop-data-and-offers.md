# 18 — Shop Data, Pricing & Offer Generation

**Milestone:** M3 · **Layer:** sim / data · **Depends on:** — · **Branch:** `task/18-shop-data-and-offers`

## Task

Fill in `shop.json` (prices, cannon/upgrade formulas, per-wave offer tables, ladder guarantees) and build
`/sim/shop`: the pure, seeded offer roll that produces one shop visit's offers.

This task produces **no** player-visible change. It ships the data, the schema, the pricing functions and
`rollShop`, all unit-tested. Task 19 wires them into the run.

## References

- GDD §8.1–8.5, §9.1, §10.2 · TR §4 (`ShopOffer`, `ShopState`), §8 (RNG streams), §9 (`shop.json`)
- `data/tiles.json` (29 tiles, `priceCategory` = `add` / `sub` / `mulLow` / `mulHigh`), `data/economy.json`
  (`maxCannons`, `startBaseValue`)

## Context

`data/shop.json` is `{}` and its schema is `z.object({}).passthrough()` — a deliberate M2 placeholder
(`sim/data/schemas.ts` §"shop.json — expanded in M3"). `RunState.rng.shop` already exists and is seeded
separately from `wave` (`sim/core/rng.ts`, `createStreams`), so this task only has to *use* it. `sim/core/types.ts`
has placeholder `ShopSlotId` and `ShopState { offers: unknown[] }` to replace.

An M3 run is **7 waves** (task 21 adds waves 4–7), so exactly **six** shops exist: after waves 1–6. The last
wave never has a shop (GDD §8.3).

## Requirements

1. **`shop.json`**. `afterWave` is **1-based** — the number of the wave just cleared, matching
   GDD §10.2's "Shop after this wave guarantees" column. The sim looks up `afterWave = waveIndex + 1`; say so in a
   comment wherever the conversion happens, since every other wave reference in the codebase is 0-based.

   Ship **exactly** this file (tune only with a recorded reason). Tables use `kind` (`add`/`sub`/`mul`),
   never `priceCategory` — price is looked up from the rolled tile's category after the draw.

   ```json
   {
     "tileSlots": 3,
     "prices": { "add": 4, "sub": 4, "mulLow": 6, "mulHigh": 9 },
     "cannon": { "base": 10, "step": 5 },
     "upgrade": { "base": 12, "step": 6 },
     "shops": [
       {
         "afterWave": 1,
         "guarantees": [],
         "table": [{ "kind": "add", "n": [1, 5], "weight": 10 }]
       },
       {
         "afterWave": 2,
         "guarantees": [{ "tileId": "mul:2" }],
         "table": [
           { "kind": "add", "n": [1, 10], "weight": 8 },
           { "kind": "sub", "n": [1, 5], "weight": 3 },
           { "kind": "mul", "n": [2, 3], "weight": 2 }
         ]
       },
       {
         "afterWave": 3,
         "guarantees": [],
         "table": [
           { "kind": "add", "n": [1, 10], "weight": 7 },
           { "kind": "sub", "n": [1, 8], "weight": 4 },
           { "kind": "mul", "n": [2, 4], "weight": 3 }
         ]
       },
       {
         "afterWave": 4,
         "guarantees": [{ "kind": "mul", "n": [2, 5] }],
         "table": [
           { "kind": "add", "n": [1, 10], "weight": 6 },
           { "kind": "sub", "n": [1, 10], "weight": 4 },
           { "kind": "mul", "n": [2, 5], "weight": 4 }
         ]
       },
       {
         "afterWave": 5,
         "guarantees": [{ "kind": "sub" }],
         "table": [
           { "kind": "add", "n": [1, 10], "weight": 5 },
           { "kind": "sub", "n": [1, 10], "weight": 5 },
           { "kind": "mul", "n": [2, 10], "weight": 4 }
         ]
       },
       {
         "afterWave": 6,
         "guarantees": [],
         "table": [
           { "kind": "add", "n": [1, 10], "weight": 5 },
           { "kind": "sub", "n": [1, 10], "weight": 5 },
           { "kind": "mul", "n": [2, 10], "weight": 4 }
         ]
       }
     ]
   }
   ```

   `waves.json` currently has **3** waves (task 21 adds 4–7). Ship all six tables now. Schema
   validation (requirement 7) must require `{1 … waves.length − 1} ⊆ afterWave set` — extra tables
   for waves that do not exist yet are allowed. Missing a table for a wave that *does* exist fails
   loudly. Adding waves 8–10 in M4 without their tables still fails `npm test`.

2. **Prices** (`/sim/shop/pricing.ts`, pure):
   - `tilePrice(tileId, data)` = `prices[tile.priceCategory]`. Price is by **category, not by N** (GDD §8.4).
   - `cannonPrice(cannonsOwned, data)` = `cannon.base + cannon.step × (cannonsOwned − 1)` — 10 with one cannon
     owned, 15 with two (GDD §8.4: "+5 per cannon already owned beyond the first").
   - `upgradePrice(upgradesBought, data)` = `upgrade.base + upgrade.step × upgradesBought` — 12 for the first.
   - No price is ever read from a hardcoded number outside `shop.json` (CLAUDE.md rule 3).

3. **`rollShop(afterWave, runState, data) → { offers: ShopOffer[]; rng: RngState }`** (`/sim/shop/rollShop.ts`),
   pure, drawing **only** from the `shop` stream. `ShopOffer` per TR §4. Offers are ordered: the tile slots
   `tile:0 … tile:<tileSlots-1>` in order, then `cannon`, then `upgrade`. Every offer starts `bought: false`.
   `cannonsOwned` is `runState.board.cannons.filter(Boolean).length`. `upgradesBought` and `cannonBaseValue`
   are read from `runState`. If no `shops[]` entry has this `afterWave`, throw a readable `Error` naming it
   (a missing table is a data bug, not an empty shop).

4. **Draw order is normative** (saves and scenarios must be reproducible — write it in the TR and in a comment):
   1. Guaranteed tile slots, left to right, filling `tile:0` onward.
   2. Remaining tile slots, left to right: `pickWeighted` over the **whole** table, then `nextInt` over that
      entry's `n` range inclusive.
   3. The cannon and upgrade offers are computed, never drawn.

   **Guarantee matching** (this is the rule the tests lock):
   - `{ tileId }` — emit that exact tile in the next leftmost slot. Consume **no** randomness.
   - `{ kind }` — `pickWeighted` over table entries whose `kind` equals the guarantee, then `nextInt` over
     that entry's full `n` range.
   - `{ kind, n: [lo, hi] }` — `pickWeighted` over table entries of that `kind` whose `n` range **overlaps**
     `[lo, hi]` (`entry.n[0] ≤ hi && lo ≤ entry.n[1]`). Then `nextInt` over the **intersection**
     `[max(entry.n[0], lo), min(entry.n[1], hi)]`. Drawing from the table entry's full range could miss the
     guarantee (a `mul [2, 10]` entry rolling `×8` against a `[2, 5]` guarantee).

   The resulting `tileId` is `` `${kind}:${n}` `` and `price` is `tilePrice(tileId, data)` — never a number
   written in `/sim`.

   Guarantees therefore always occupy the leftmost cards — a deliberate legibility call (GDD v0.6 §0): the
   guaranteed-useful card is where the player looks first.

5. **Cannon and upgrade offers.** The cannon offer is always present as a slot but is `available: false` when
   `cannonsOwned >= economy.maxCannons` (GDD v0.6 §0 refines §8.3: the card keeps its place, dimmed, rather than
   vanishing and reflowing the row). The upgrade offer carries `fromValue: cannonBaseValue` and
   `toValue: cannonBaseValue + 1` so the card can read `1 → 2` (GDD v0.6 §0).

6. **Duplicates are unrestricted** (GDD §8.5): the same tile id may fill two slots of one shop and may reappear in
   later shops. No dedupe anywhere.

7. **Schema validation** (`sim/data/schemas.ts`), each with a readable message and a test. Per-file checks
   live on `ShopFileSchema`; the waves-coverage check lives on `GameDataSchema.superRefine` (both files
   must have parsed first), reported as `shop.json: …` via an issue path that starts with `'shop'`.
   - `afterWave` values are unique positive integers. `{1 … waves.length − 1} ⊆ afterWave set` — every
     non-final wave has a table. Extra tables (afterWave ≥ `waves.length`) are allowed so this task can
     ship six M3 shops while `waves.json` still has three waves. Duplicates and gaps *inside* 1 … waves.length−1
     fail. Adding waves 8–10 in M4 without their tables must fail `npm test` loudly.
   - `prices` has a key for every `priceCategory` used in `tiles.json`.
   - every table is non-empty; `weight` is a positive integer; `n` is `[min, max]` with `min ≤ max` inside the kind's
     legal range (`add`/`sub` 1–10, `mul` 2–10) and **every** id in that range exists in `tiles.json`.
   - `guarantees.length ≤ tileSlots`; a `{ tileId }` guarantee names a real tile; a `{ kind, n? }` guarantee is
     satisfiable — at least one table entry of that kind with an overlapping `n` range.
   - `tileSlots ≥ 1`.

8. **No behaviour beyond the roll.** This task must not touch `applyCommand`, `RunState.phase`, or anything in
   `/game`. `ShopState`/`ShopOffer`/`ShopSlotId` types are updated in `/sim/core/types.ts` (TR §4) so task 19 can
   consume them, but nothing constructs a `ShopState` yet. Do **not** bump `economy.json` `schemaVersion` —
   that is task 19, when `RunState.shop` and wave `reward` actually change.

9. **Fixture helper.** `ShopFileSchema` will reject `shop: {}`. Add `fakeShop()` in `/tests/helpers` (same
   pattern as `fakeScreenSettings`) returning a valid shop file, and replace every `shop: {}` in:
   `tests/sim/data/{load,waves,levels}.test.ts`, `tests/sim/commands/{fixtures.ts,loadLevel.test.ts}`,
   `tests/game/{store,testHandle}.test.ts`. A one-wave fixture may use `shops: []` (no non-final wave).

## Tests

- `tests/sim/shop/pricing.test.ts`: the three price functions against the shipped table, including the escalation
  steps (cannon 10/15/20/25, upgrade 12/18/24) and one price per `priceCategory`.
- `tests/sim/shop/rollShop.test.ts`:
  - **determinism**: the same `(afterWave, rng, data)` gives byte-identical offers; a different seed eventually
    gives different offers.
  - **guarantees**: over seeds 1–200, every shop's offers satisfy that wave's guarantees, and the guaranteed card
    is in the leftmost slot(s).
  - **table respect**: every rolled tile's kind and N are inside the wave's table ranges; the after-wave-1 shop
    only ever offers `add:1`–`add:5`.
  - **duplicates happen**: across seeds 1–200 at least one shop rolls the same tile id twice (proves no dedupe).
  - **cannon availability**: `available: false` and unchanged layout at `maxCannons`; correct escalating price
    below it.
  - **upgrade card**: `fromValue`/`toValue` follow `cannonBaseValue`.
  - **stream isolation**: rolling a shop advances only the `shop` stream — the `wave` stream state is untouched
    (GDD §8.5, §15.4). Assert on the returned `rng` and that no `wave` draw is consumed.
- Data test: the shipped `/data` directory still parses (`tests/data/*`), and the deliberate failure cases in
  requirement 7 are covered by fixtures (a missing table for a wave, an unsatisfiable guarantee, an out-of-range
  `n`, a missing price category).

## Acceptance Criteria

- [ ] `shop.json` ships prices, formulas and six per-wave tables with guarantees matching GDD §10.2
- [ ] `ShopFileSchema` validates all of requirement 7, with fixture tests for each failure
- [ ] `rollShop` is pure, deterministic, `shop`-stream-only, and honours guarantees, ranges and duplicates
- [ ] Prices come only from data; no number hardcoded in `/sim`
- [ ] `npm test`, `typecheck`, `lint` pass

## Completion Notes

**Status:** Complete
**Completed:** 2026-09-16
**PR:** #33 · stacked on #32 (`cursor/m3-spec-clarifications-8f5d`)

**Acceptance criteria:**
- [x] `shop.json` ships prices, formulas and six per-wave tables with guarantees matching GDD §10.2 — Met
- [x] `ShopFileSchema` validates all of requirement 7, with fixture tests for each failure — Met (`tests/sim/data/shop.test.ts`)
- [x] `rollShop` is pure, deterministic, `shop`-stream-only, and honours guarantees, ranges and duplicates — Met
- [x] Prices come only from data; no number hardcoded in `/sim` — Met
- [x] `npm test`, `typecheck`, `lint` pass — Met (809 tests)

**Verification:** npm test ✔ (54 files / 809 tests) · typecheck ✔ · lint ✔ · build not required · e2e not required

**Deviations from spec:**
- Branch name is `cursor/18-shop-data-and-offers-8f5d` (stacked-PR convention) rather than `task/18-shop-data-and-offers`.
- Two-wave schema fixtures wrap `fakeShop()` with `afterWave` 1…`waves.length-1` tables whose `n` is `[1, 1]`, so they parse against a one-tile `tiles` array. One-wave fixtures keep `shops: []` as specified.

**Architectural decisions made:**
- `ShopFileSchema` holds per-file rules (unique `afterWave`, legal `n`, weights, satisfiable `{ kind, n? }` guarantees, `tileSlots ≥ 1`). Cross-file rules live on `GameDataSchema.superRefine` with issue paths starting at `'shop'`: wave coverage `{1…waves.length-1} ⊆ afterWave`, every id in a table range exists in `tiles.json`, `{ tileId }` names a real tile, `prices` covers every `priceCategory` used by tiles.
- Extra `afterWave` tables (`≥ waves.length`) are allowed so the six M3 shops ship while `waves.json` still has three waves.
- `rollShop` returns `{ offers, rng }` where `rng` is the advanced **shop** stream only; it does not write `RunState.shop` or change phase.

**Design questions raised:**
- None.

**Known issues / follow-up:**
- Task 19 must call `rollShop(waveIndex + 1, …)` (1-based `afterWave`) when entering the shop, install `ShopState`, and bump `economy.json` `schemaVersion`.

**Files created:** `sim/shop/pricing.ts`, `sim/shop/rollShop.ts`, `tests/helpers/shop.ts`, `tests/sim/shop/pricing.test.ts`, `tests/sim/shop/rollShop.test.ts`, `tests/sim/data/shop.test.ts`
**Files modified:** `data/shop.json`, `sim/core/types.ts`, `sim/data/schemas.ts`, `sim/shop/index.ts`, `tests/sim/commands/fixtures.ts`, `tests/sim/commands/loadLevel.test.ts`, `tests/sim/data/{load,waves,levels}.test.ts`, `tests/game/{store,testHandle}.test.ts`, `TASKS.md`, `tasks/18-shop-data-and-offers.md`

**Notes for next agent:**
- Offers are rolled here; nothing opens a shop yet. Convert with `afterWave = waveIndex + 1`. Guaranteed cards are always leftmost. Cannon stays in layout at `maxCannons` with `available: false`. Do not bump `schemaVersion` until `RunState.shop` and wave `reward` actually change.
