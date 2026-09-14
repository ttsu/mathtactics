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

**Status:** Not Started
