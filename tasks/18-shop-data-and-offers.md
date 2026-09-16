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

1. **`shop.json`** in the shape below. `afterWave` is **1-based** — the number of the wave just cleared, matching
   GDD §10.2's "Shop after this wave guarantees" column. The sim looks up `afterWave = waveIndex + 1`; say so in a
   comment wherever the conversion happens, since every other wave reference in the codebase is 0-based.

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
       }
     ]
   }
   ```

   Draft tables for the six M3 shops, from GDD §10.2 (tune only with a recorded reason):

   | afterWave | Guarantees | Table (`kind`, `n` range, weight) | Ladder intent |
   |---|---|---|---|
   | 1 | — | add [1,5] w10 | `+N` only, small N |
   | 2 | `{ "tileId": "mul:2" }` | add [1,10] w8 · sub [1,5] w3 · mul [2,3] w2 | at least one `×2` |
   | 3 | — | add [1,10] w7 · sub [1,8] w4 · mul [2,4] w3 | cannon affordable around here |
   | 4 | `{ "kind": "mul", "n": [2, 5] }` | add [1,10] w6 · sub [1,10] w4 · mul [2,5] w4 | at least one `×N` |
   | 5 | `{ "kind": "sub" }` | add [1,10] w5 · sub [1,10] w5 · mul [2,10] w4 | at least one `−N`; full range opens |
   | 6 | — | add [1,10] w5 · sub [1,10] w5 · mul [2,10] w4 | everything available |

2. **Prices** (`/sim/shop/pricing.ts`, pure):
   - `tilePrice(tileId, data)` = `prices[tile.priceCategory]`. Price is by **category, not by N** (GDD §8.4).
   - `cannonPrice(cannonsOwned, data)` = `cannon.base + cannon.step × (cannonsOwned − 1)` — 10 with one cannon
     owned, 15 with two (GDD §8.4: "+5 per cannon already owned beyond the first").
   - `upgradePrice(upgradesBought, data)` = `upgrade.base + upgrade.step × upgradesBought` — 12 for the first.
   - No price is ever read from a hardcoded number outside `shop.json` (CLAUDE.md rule 3).

3. **`rollShop(afterWave, runState, data) → { offers: ShopOffer[]; rng: RngState }`** (`/sim/shop/rollShop.ts`),
   pure, drawing **only** from the `shop` stream. `ShopOffer` per TR §4. Offers are ordered: the tile slots
   `tile:0 … tile:<tileSlots-1>` in order, then `cannon`, then `upgrade`.

4. **Draw order is normative** (saves and scenarios must be reproducible — write it in the TR and in a comment):
   1. Guaranteed tile slots, left to right, filling `tile:0` onward: `pickWeighted` over the wave's table entries
      **matching the guarantee**, then `nextInt` over that entry's `n` range. A `{ tileId }` guarantee consumes
      **no** randomness.
   2. Remaining tile slots, left to right: `pickWeighted` over the whole table, then `nextInt` over the `n` range.
   3. The cannon and upgrade offers are computed, never drawn.

   Guarantees therefore always occupy the leftmost cards — a deliberate legibility call (GDD v0.6 §0): the
   guaranteed-useful card is where the player looks first.

5. **Cannon and upgrade offers.** The cannon offer is always present as a slot but is `available: false` when
   `cannonsOwned >= economy.maxCannons` (GDD v0.6 §0 refines §8.3: the card keeps its place, dimmed, rather than
   vanishing and reflowing the row). The upgrade offer carries `fromValue: cannonBaseValue` and
   `toValue: cannonBaseValue + 1` so the card can read `1 → 2` (GDD v0.6 §0).

6. **Duplicates are unrestricted** (GDD §8.5): the same tile id may fill two slots of one shop and may reappear in
   later shops. No dedupe anywhere.

7. **Schema validation** (`sim/data/schemas.ts`), each with a readable message and a test:
   - exactly one `shops` entry per non-final wave — the set of `afterWave` values is exactly `1 … waves.length − 1`,
     no duplicates, no gaps. Adding waves 8–10 in M4 without their tables must fail `npm test` loudly.
   - `prices` has a key for every `priceCategory` used in `tiles.json`.
   - every table is non-empty; `weight` is a positive integer; `n` is `[min, max]` with `min ≤ max` inside the kind's
     legal range (`add`/`sub` 1–10, `mul` 2–10) and **every** id in that range exists in `tiles.json`.
   - `guarantees.length ≤ tileSlots`; a `{ tileId }` guarantee names a real tile; a `{ kind, n? }` guarantee is
     satisfiable — at least one table entry of that kind with an overlapping `n` range.
   - `tileSlots ≥ 1`.

8. **No behaviour beyond the roll.** This task must not touch `applyCommand`, `RunState.phase`, or anything in
   `/game`. `ShopState`/`ShopOffer`/`ShopSlotId` types are updated in `/sim/core/types.ts` (TR §4) so task 19 can
   consume them, but nothing constructs a `ShopState` yet.

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

_(filled in by `/finish-task`)_
