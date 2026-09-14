# 04 — Core Types, RNG & Data Schemas

**Milestone:** M0 · **Layer:** sim / data · **Depends on:** 01 · **Branch:** `task/04-core-types-and-data`

## Task

Define the simulation's core types, coordinate helpers, seeded RNG with named streams, Zod
schemas for all data files, a validating loader, and initial data content for tiles, economy,
presentation, and an empty levels file.

## References

- GDD §2, §5.2, §6.1, §8.4, §9.1, §13 · TR §3, §4, §8, §9

## Requirements

1. `/sim/core/coords.ts`: `Lane`, `Col`, `Cell`, `LANES = 5`, `COLS = 8`, `isCannonSlot`, `isTileCell`,
   `cellKey`, iteration helpers.
2. `/sim/core/types.ts`: types from TR §4 (`TileDef`, `TileId`, `TilePiece`, `Trait`, `Robot`, `Board`,
   `RunState`, `Phase`, `PlanningSnapshot`), `GameEvent` union from TR §7, `Command` / `CommandError` from TR §5.
   Types only; no behavior beyond tiny pure helpers.
3. `/sim/core/tiles.ts`: `applyTile(value, tileDef) → number` for add/sub/mul. No clamping.
4. `/sim/core/rng.ts` per TR §8: string-seeded, pure, JSON-serializable state; `nextInt`, `pickWeighted`,
   `createStreams(seed) → { wave, shop }` producing independent streams.
5. `/sim/data/schemas.ts`: Zod schemas for `tiles.json`, `robots.json`, `economy.json`, `shop.json`,
   `waves.json`, `levels.json`, `presentation.json`. For files not needed until later milestones
   (`shop`, `waves`, `robots`), define minimal schemas that accept an empty/placeholder structure, marked
   `// expanded in M2/M3/M4`.
6. `/sim/data/load.ts`: `parseGameData(raw: Record<string, unknown>) → GameData` (pure, throws readable
   errors with file + path). Node-side helper in `/tests` or `/scripts` reads the files from disk;
   the browser side imports JSON via Vite.
7. **Data content:**
   - `tiles.json`: all 29 tiles (`add:1…10`, `sub:1…10`, `mul:2…10`) with `priceCategory`
     (`add`, `sub`, `mulLow` for ×2–5, `mulHigh` for ×6–10) and color key.
   - `economy.json`: `schemaVersion: 1`, `baseHp: 100`, `startCoins: 0`, `startCannonLane: 2`,
     `startBaseValue: 1`, `maxCannons: 5`, `income: { kill: 1, exactKill: 2, waveCleared: 3 }`.
   - `presentation.json`: placeholder pacing values (ms) and tile colors.
   - `levels.json`, `robots.json`, `shop.json`, `waves.json`: minimal valid placeholders.
8. Tests: RNG determinism (same seed → same sequence), stream independence (drawing from `shop` doesn't change
   `wave` sequence), `applyTile` including negatives and large products, schema rejects a malformed tile,
   **real `/data` directory loads successfully**.

## Out of Scope

Commands (06), resolution (07), store (05).

## Acceptance Criteria

- [ ] All types compile under `tsconfig.sim.json` (no DOM)
- [ ] RNG determinism and stream-independence tests pass
- [ ] `npm test` fails with a readable message if `/data/tiles.json` has an invalid entry (verified by a test using a fixture)
- [ ] All 29 tiles present; no tuning numbers hardcoded in `/sim` source
- [ ] `npm test`, `typecheck`, `lint` pass

## Completion Notes

**Status:** Not Started
