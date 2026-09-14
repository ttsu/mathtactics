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

**Status:** Complete
**Completed:** 2026-09-14
**PR:** not yet opened

**Acceptance criteria:**
- [x] All types compile under `tsconfig.sim.json` (no DOM) — Met (`npm run typecheck` runs both `tsconfig.json` and `tsconfig.sim.json`; `sim/**` and `tests/sim/**`/`tests/helpers/**` are only in the latter's `include`, no DOM lib)
- [x] RNG determinism and stream-independence tests pass — Met (`tests/sim/core/rng.test.ts`: same-seed → same sequence, different seed → different sequence, purity, `createStreams` gives `wave`/`shop` distinct states and drawing from `shop` never advances `wave`)
- [x] `npm test` fails with a readable message if `/data/tiles.json` has an invalid entry (verified by a test using a fixture) — Met (`tests/sim/data/load.test.ts`: malformed/duplicate/out-of-range/inconsistent-category tile fixtures each assert the thrown message names `tiles.json` and the offending path, e.g. `tiles.json: [3].n: ...`)
- [x] All 29 tiles present; no tuning numbers hardcoded in `/sim` source — Met (`data/tiles.json` has all 29; a real-`/data` test asserts the count and every id; `npm run lint` passes with no new exemptions — all economy/pricing/pacing numbers live in `/data/*.json`, and the only numeric literals in new `/sim` source are structural constants tied to board shape (`LANES`/`COLS`) or the RNG algorithm's own fixed parameters, not gameplay tuning)
- [x] `npm test`, `typecheck`, `lint` pass — Met (see Verification)

**Verification:**
- `npm test` — 9 test files, 57 tests passed (25 new in `tests/sim/core/{coords,tiles,rng}.test.ts`, 10 new in `tests/sim/data/load.test.ts`, plus the 22 pre-existing)
- `npm run typecheck` — `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.sim.json --noEmit`, both clean
- `npm run lint` — `eslint .`, 0 errors/warnings
- `npm run build` — `vite build` succeeds (pre-existing Phaser chunk-size warning only, unrelated to this task)
- `npm run test:e2e` — 11 passed (WebKit), run because `game/board/layout.ts` was touched (now imports `LANES`/`COLS` from `/sim/core/coords` instead of duplicating `5`/`8`)
- `npx prettier --check` on all new/changed files — clean after one `--write` pass (3 files needed formatting)

**TDD evidence:**
- `sim/core/{coords,tiles,rng}.ts`: wrote `tests/sim/core/{coords,tiles,rng}.test.ts` first, then implemented. First run of `rng.test.ts` and `tiles.test.ts` passed immediately (25/25) since the sfc32/cyrb128 implementation was written from the well-known reference algorithm in one pass — no red phase to report beyond "module doesn't exist yet" before the file was written.
- `sim/data/{schemas,load}.ts`: wrote `tests/sim/data/load.test.ts` (malformed-tile fixtures, real-`/data` load) alongside the schemas — RED was two `zodcheck*.mjs` scratch scripts run against the real `zod@4.6.5` package first (not committed) to confirm v4 API behavior that differs from v3 assumptions: `z.record(keySchema, valueSchema)` requires both args and, when `keySchema` is a `z.enum`, produces an **exhaustive** record (all enum members required, confirmed by a failing `safeParse({green:'#fff'})` missing `blue`) rather than a partial map — this shaped `tileColors` in `presentation.json` to require all three color keys. Once `schemas.ts`/`load.ts` were written against confirmed behavior, `load.test.ts` passed on first run (10/10).
- `game/board/layout.ts`: pre-existing `tests/game/layout.test.ts` continued to pass unmodified after replacing the hardcoded `LANE_COUNT = 5` / `COLUMN_COUNT = 8` with re-exports of `LANES`/`COLS` imported from `/sim/core/coords` — proves the single source of truth swap was behavior-preserving.

**Deviations from spec:**
- **Tile color/starred fields** (GDD §9.1 "color key"): `tiles.json` entries carry `color: 'green'|'blue'|'orange'` plus a `starred: boolean` (true for `×6`–`×10`) rather than a fourth color value, per the task's own suggested call. `TileDef` in `/sim/core/types.ts` (TR §4) is unchanged (`id, kind, n, priceCategory` only) — `color`/`starred` are data-file-only fields consumed by presentation later; the Zod-inferred tile type is a structural superset of `TileDef`, so it still satisfies `TileDef` wherever that's expected.
- **`robots.json`, `shop.json`, `waves.json`, `levels.json` placeholder shapes**: since none of these have a real schema yet (M2–M4/task 11), I picked the simplest shape that matches each file's eventual character rather than forcing one convention: `robots.json` = `[]` (it'll be a flat list of robot templates), `shop.json` = `{}` (it'll be a price-table/offer-table object, no natural list), `waves.json` = `{ waves: [] }` and `levels.json` = `{ levels: [] }` (both will be named collections, e.g. waves also needs ladder-guarantee metadata alongside the list). Each schema is `z.array(z.unknown())` / a loosely-typed object, commented `// expanded in M2/M3/M4/task 11` inline in `schemas.ts`. A future task rewriting these schemas will also rewrite the file's top-level shape if it disagrees — nothing downstream depends on these shapes yet (commands/resolution/shop are all out of scope here).
- **Readable Zod error format**: `parseGameData` reports only the **first** validation issue found (not all of them) — e.g. `tiles.json: [3].n: mul n must be 2-10`. TR §9 asks for "a readable path on failure," which a first-issue report satisfies more simply than aggregating every issue across every file; a data file with multiple errors will surface them one `npm test` run at a time. Recorded here since it's a real behavioral choice, not just wording.
- **`PlanningSnapshot`** (TR §5 only names it, doesn't shape it) is `{ cells, tray, cannons }` — matching TR §5's own parenthetical ("board cells, tray, cannons") rather than a full `Board` (which also has `robots`, which planning commands never touch).
- **RNG warm-up**: `seedRng` discards the first 15 sfc32 outputs after seeding from `cyrb128`, a standard practice for this generator pairing (shorter early-output correlation) — not requested by TR §8 but within "sfc32 seeded via a string hash… is fine" per the task's decisions. `WARMUP_STEPS = 15` is an algorithm parameter, not gameplay tuning, so it stays a code constant rather than moving to `/data`.
- **Schema bounds tied to design constants, not re-hardcoded**: `economy.json`'s `startCannonLane` (`0..LANES-1`) and `maxCannons` (`1..LANES`) bounds import `LANES` from `/sim/core/coords` instead of repeating `4`/`5` as separate magic numbers, so the one source of truth for board shape can't drift from the schema that validates against it.

**Architectural decisions made:**
- `sim/core/index.ts` and `sim/data/index.ts` are now real barrels (`export * from …`) instead of task-01 placeholders; no name collisions across `coords.ts`/`rng.ts`/`tiles.ts`/`types.ts` or `schemas.ts`/`load.ts`.
- `nextInt`/`pickWeighted` are implemented as pure `(state) => [value, nextState]` functions over a plain sfc32 state tuple, not the usual JS closure-with-mutable-state PRNG pattern, so `RngState` can live inside `RunState` as plain JSON (TR §4, §8) and be replayed exactly.
- The node-side `/data` disk loader lives at `tests/helpers/loadDataFiles.ts` (not `/scripts`), since it's currently only consumed by tests; a future CLI/store task can promote or duplicate it into `/scripts` if it needs the same reader outside tests.

**Design questions raised:**
- None. Where TR/GDD left a shape unspecified (placeholder file shapes, warm-up count, first-vs-all-issues error reporting), the call was mechanical enough to make and record above.

**Known issues / follow-up:**
- `robots.json`/`shop.json`/`waves.json`/`levels.json` placeholder shapes (see Deviations) are genuinely provisional — expect their schemas and top-level shape to be replaced wholesale by the milestone that implements them, not incrementally extended.
- `GameData` (`z.infer<typeof GameDataSchema>`) is exported but nothing yet consumes it — `applyCommand`/`resolveTurn` (tasks 06/07) are the first real consumers, per TR §5/§6.

**Files created:** `sim/core/coords.ts`, `sim/core/rng.ts`, `sim/core/tiles.ts`, `sim/core/types.ts`, `sim/data/schemas.ts`, `sim/data/load.ts`, `tests/helpers/loadDataFiles.ts`, `tests/sim/core/coords.test.ts`, `tests/sim/core/tiles.test.ts`, `tests/sim/core/rng.test.ts`, `tests/sim/data/load.test.ts`, `data/tiles.json`, `data/economy.json`, `data/presentation.json`, `data/robots.json`, `data/shop.json`, `data/waves.json`, `data/levels.json`

**Files modified:** `sim/core/index.ts`, `sim/data/index.ts` (task-01 placeholders → real barrels), `game/board/layout.ts` (`LANE_COUNT`/`COLUMN_COUNT` now import `LANES`/`COLS` from `/sim/core/coords` instead of duplicating them); deleted `data/.gitkeep` (superseded by real files, matching how task 01 handled `tests/game/.gitkeep`)

**Notes for next agent:**
- `TileDef` (core type) and the `tiles.json` Zod-inferred type are intentionally not identical — the data file additionally carries `color`/`starred` for presentation. Don't add those fields to `TileDef` in `/sim/core/types.ts` unless the sim itself needs them; presentation code (task 09+) should read them off the loaded `GameData.tiles`, not off `TileDef`.
- `parseGameData(raw)` takes an already-parsed `{ tiles, robots, economy, shop, waves, levels, presentation }` object, not file paths — task 05 (store) will need its own browser-side assembly of that object from Vite JSON imports (`import tiles from '../../data/tiles.json'`, one per file) before calling it; `tests/helpers/loadDataFiles.ts` shows the Node-side equivalent.
- If a later task adds robots/shop/waves/levels content, replace the placeholder schema in `sim/data/schemas.ts` for that file entirely — they're marked `// expanded in M2/M3/M4/task 11` for exactly that.
