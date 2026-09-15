# 06 — Planning Commands & Undo

**Milestone:** M1 · **Layer:** sim · **Depends on:** 04 · **Branch:** `task/06-planning-commands`

## Task

Implement pure `applyCommand` for planning-phase commands — placing, moving, and returning tiles;
moving cannons; multi-level undo — with all validation rules, plus `loadLevel` to install an M1
puzzle level.

## References

- GDD §3.3, §3.4, §4 (planning), §4.3, §9.3, §9.4 · TR §4, §4.1, §5

## Requirements

1. `/sim/commands/applyCommand.ts` handling: `placeTile`, `moveTile`, `returnTile`, `moveCannon`, `undo`,
   `loadLevel`. (`endTurn` delegates to task 07's `resolveTurn`; until merged, return `wrong_phase` —
   coordinate via the dependency order, don't duplicate logic.)
2. Validation (return typed `CommandError`, never throw for player errors):
   - All planning commands require `phase === 'planning'` → else `wrong_phase`.
   - Tile targets must be cols 1–7 → `not_a_tile_cell`.
   - Target cell must have no tile → `cell_occupied`.
   - Source or target cell containing an on-board robot → `cell_locked`.
   - `placeTile` piece must be in `tray` → `piece_not_in_tray`.
   - `moveTile`/`returnTile` source must have a tile → `no_tile_here`.
   - `moveCannon`: source must have a cannon → `no_cannon_here`; target must be empty → `slot_occupied`.
   - `undo` with empty stack → `nothing_to_undo`.
3. Every successful planning command (not `undo`) pushes a `PlanningSnapshot` of `board.cells`,
   `board.cannons`, and `tray`. `undo` pops and restores it. Undo never touches coins, robots, or phase.
4. Tray order: returned tiles append to the end; placed tiles are removed from their tray position.
5. Pure: input state is never mutated (test with `Object.freeze`/deep-freeze).
6. `loadLevel(levelId)`: builds a `RunState` with `mode: 'level'` from `levels.json` (task 04 schema; expand
   the level schema here: cannons, tiles pre-placed on board, tray tile ids, robots with lane/col/hp, base value).
   Assign stable `pieceId`/`robotId` via `nextIds`.
7. Planning commands emit no events (return `events: []`).

## Tests

- Each error code has at least one test.
- Place → move → return → undo ×3 restores the exact original state (deep equality).
- A tile under a robot can't be moved or returned; a tile can't be placed onto a robot's cell.
- Cannon can move to an empty slot, not an occupied one.
- Tiles may be placed in unarmed lanes.
- Deep-frozen input state doesn't throw.

## Acceptance Criteria

- [ ] All validation rules from GDD §3.3–3.4, §4.3, §9.3–9.4 enforced with typed errors
- [ ] Undo is multi-level and exact
- [ ] `loadLevel` produces a valid `RunState` from data
- [ ] No mutation of inputs
- [ ] `npm test`, `typecheck`, `lint` pass

## Completion Notes

**Status:** Complete
**Completed:** 2026-09-14
**Branch:** `task/06-planning-commands`

**Acceptance criteria:**

- [x] All validation rules from GDD §3.3–3.4, §4.3, §9.3–9.4 enforced with typed errors — Met: `placeTile`/`moveTile`/`returnTile`/`moveCannon`/`undo` in `sim/commands/planning.ts` each check in the ruled precedence order (`wrong_phase` → `not_a_tile_cell` → `cell_locked` → `no_tile_here`/`piece_not_in_tray`/`no_cannon_here` → `cell_occupied`/`slot_occupied`); every error code has at least one test in `tests/sim/commands/planningCommands.test.ts`, including the "robot standing on a tile" precedence case.
- [x] Undo is multi-level and exact — Met: `PlanningSnapshot`s are pushed by every successful non-undo planning command and popped by `undo`; `tests/sim/commands/planningCommands.test.ts` has a place → move → return → undo×3 round trip asserting full deep equality with the original state, plus a case proving undo never touches coins/robots/phase.
- [x] `loadLevel` produces a valid `RunState` from data — Met: `sim/commands/level.ts`'s `buildLevelState(levelDef, data)` builds the whole `RunState` (level id/seed/rng streams, `economy.json` baseHp/coins/schemaVersion, level `baseValue` → `cannonBaseValue`, board tiles/tray/cannons/robots with stable ids via `nextIds`); `applyCommand`'s `loadLevel` case looks the level up in `data.levels.levels` and calls it, ignoring/resetting whatever `state` was. Covered by `tests/sim/commands/loadLevel.test.ts` (unit tests on `buildLevelState` plus one round-trip through the real `parseGameData`/levels.json zod schema) and `tests/sim/data/levels.test.ts` (schema acceptance/rejection cases).
- [x] No mutation of inputs — Met: every command function returns a new `RunState` built with object/array spreads; `tests/sim/commands/planningCommands.test.ts`'s "does not mutate a deeply frozen input state" test deep-freezes the input `RunState` (via a `deepFreeze` test helper) and asserts `applyCommand` doesn't throw.
- [x] `npm test`, `typecheck`, `lint` pass — Met (see Verification).

**Verification:**

- `npm test` — 18 files, 172 tests passed (127 pre-existing + 45 new: 26 in `tests/sim/commands/planningCommands.test.ts`, 9 in `tests/sim/commands/loadLevel.test.ts`, 10 in `tests/sim/data/levels.test.ts`).
- `npm run typecheck` — `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.sim.json --noEmit`, both clean.
- `npm run lint` — `eslint .`, 0 errors/warnings.
- `npm run build` — succeeds (pre-existing Phaser chunk-size warning only, unrelated to this task).
- `npx prettier --check` on all new/changed files — clean after one `--write` pass.

**Deviations from spec / naming calls made (none conflict with GDD/TR, all within task ruling latitude):**

- **`levels.json` schema field names**: the brief left the level schema's exact shape open ("expand the level schema here: cannons, tiles pre-placed on board, tray tile ids, robots with lane/col/hp, base value"). Chose: `cannonLanes: Lane[]` (list of lanes with a cannon, not a fixed 5-slot boolean array — more natural to hand-author) validated unique; `boardTiles: { lane, col, tileId }[]` (validated unique cells) for pre-placed tiles; `tray: TileId[]` for tray contents; `baseValue: number` for the level's cannon base value (maps to `RunState.cannonBaseValue`); `robots: { lane, col, hp, trait? }[]` with `trait` defaulting to `{ type: 'none' }` per the ruling. `id`/`col`/`lane` are validated and narrowed to `TileId`/`Col`/`Lane` in the zod schema itself (`.transform`), mirroring `TileDefSchema`'s existing pattern, so `buildLevelState` consumes already-branded types with no casts.
- **Robot `maxHp` for levels**: set to the level's given `hp` (a level robot's starting HP is by definition its max HP — there's no other value it could sensibly be). Not flagged as a real design question since GDD/TR don't suggest otherwise and no other value would make sense.
- **`isBoss`**: always `false` for level robots — out of v1 scope (CLAUDE.md "do not implement" doesn't list Boss, but M1 puzzle levels are plain robots per task 11's level descriptions; nothing in this task's scope calls for a boss level).
- **`data/levels.json`** left as `{ "levels": [] }` (already the M0 placeholder) per the task's own ruling — task 11 authors the real content; all tests here construct `LevelDef`s inline.
- **`stubApplyCommand`** kept exported from `game/state/store.ts` (unchanged) since `tests/game/store.test.ts` and `tests/game/testHandle.test.ts` still import it directly; only `game/main.tsx`'s injected function changed, from `stubApplyCommand` to the real `applyCommand` (`sim/commands`).

**Design questions raised:** None — every open call above was either explicitly left to this task by the brief/ruling or has no plausible alternative under GDD/TR.

**Known issues / follow-up:**

- `endTurn`, `buyOffer`, `leaveShop`, `newRun` all return `wrong_phase` unconditionally in M1, per the ruling — task 07 wires `endTurn` into `resolveTurn`; `newRun`/`buyOffer`/`leaveShop` remain unimplemented until the M2/M3 run and shop land.
- `buildLevelState` doesn't cross-validate that a level's `boardTiles`/`tray` tile ids actually exist in `tiles.json` — each file's zod schema validates its own shape independently (existing `GameDataSchema` composition pattern); a level referencing a nonexistent tile id would currently build a `RunState` with a `TilePiece` pointing at an unknown `TileId`, only surfacing later wherever that piece's tile def is looked up. Cross-file referential checks aren't done anywhere else in `schemas.ts` today either, so this preserves the existing pattern rather than introducing a one-off exception; worth revisiting if task 11's real levels need this caught earlier (at data-load time, in `npm test`).

**Files created:** `sim/commands/applyCommand.ts`, `sim/commands/planning.ts`, `sim/commands/level.ts`, `sim/commands/boardQueries.ts`, `sim/commands/ids.ts`, `sim/commands/types.ts`, `tests/sim/commands/fixtures.ts`, `tests/sim/commands/planningCommands.test.ts`, `tests/sim/commands/loadLevel.test.ts`, `tests/sim/data/levels.test.ts`

**Files modified:** `sim/data/schemas.ts` (expanded `levels.json` schema: `LevelDefSchema`, `TraitSchema`, `TileIdRefSchema`, `LaneSchema`, `TileColSchema`; exports `LevelDef`), `sim/commands/index.ts` (real barrel, was task-01 placeholder), `game/main.tsx` (wires the real `applyCommand` in place of `stubApplyCommand`), `TASKS.md` (status for task 06)

**Notes for next agent:**

- Task 07 (`resolveTurn`) wires `endTurn` into `applyCommand` — coordinate with (don't duplicate) the `applyCommand.ts` dispatcher here; the `endTurn` case currently just returns `wrong_phase` and is the one line to change.
- `buildLevelState(levelDef, data)` (`sim/commands/level.ts`) is written to be reusable by task 08's scenario runner for scenario files (which do exercise robot traits) — it takes a plain `LevelDef` + `GameData`, nothing `applyCommand`-specific.
- `sim/commands/ids.ts`'s `allocatePieceId`/`allocateRobotId` establish the `piece:<n>` / `robot:<n>` id convention and the "thread `nextIds` through, return `[id, nextIds]`" pattern — reuse both for any future id allocation (e.g. shop purchases in M3, ball ids in task 07).
