# 09 — Board Rendering & Drag-and-Drop

**Milestone:** M1 · **Layer:** presentation · **Depends on:** 05, 06 · **Branch:** `task/09-board-and-drag`

## Task

Render the planning-phase board from store state in Phaser (cannons, tiles, tray, robots with HP)
using placeholder shapes, and implement touch-friendly drag-and-drop for tiles and cannons that
dispatches planning commands. Wire End Turn and Undo HUD buttons.

## References

- GDD §3, §4.3, §9.3–9.4, §11, §12.1 · TR §10, §11

## Requirements

1. **Board sync:** a Phaser scene subscribes to `run.board`, `run.tray`, `run.cannonBaseValue` and reconciles
   sprites by id (`pieceId`, `robotId`, lane for cannons). No full re-creation per change.
2. **Placeholder visuals** (legibility first, GDD §11.2):
   - Tiles: rounded squares, `+` green / `−` blue / `×` orange (colors from `presentation.json`), operator+number
     as the dominant element. Use real `−` and `×` glyphs.
   - Cannons: dark block in col 0 showing the base value as a small number.
   - Robots: simple silhouette block with **HP as the largest text on the board**.
   - Locked cells: subtle indicator while dragging (e.g. red tint when hovering a locked/occupied target).
   - Tray: horizontal strip below the grid; scrolls or wraps if more pieces than fit (≥ 12 visible at 60pt+).
3. **Drag-and-drop:**
   - Pointer-down on a tile (tray or cell) or cannon starts a drag; the piece lifts (scale up) and follows the finger,
     offset slightly above the finger so it isn't hidden.
   - Drop target = nearest valid cell/slot within a generous snap radius (≥ 0.6 cell); invalid → piece animates back.
   - Drop onto tray area → `returnTile`.
   - Each drop dispatches exactly one command; the board re-renders from the store result (no optimistic local state
     that can diverge).
   - Multi-touch: ignore second pointers during a drag.
4. **HUD (React):** End Turn button dispatches `endTurn` (task 07); Undo button dispatches `undo`, disabled when
   `run.undo` is empty. Both ≥ 60pt. Buttons disabled while `playback.status === 'playing'`.
5. Implement `__GAME__.cellToClient(cell)` for e2e.
6. e2e (WebKit): load a scenario/level; drag a tray tile to a cell with real touch/pointer events via `cellToClient`;
   assert `getState()` shows the tile there; drag onto a locked cell → unchanged; Undo restores.

## Out of Scope

Ball animation and playback (10). After End Turn in this task, the board may simply re-sync to the resolved state.

## Acceptance Criteria

- [ ] Board reflects state for any scenario loaded via `__GAME__.loadScenario`
- [ ] Tile and cannon drags work with touch on the iPad preview (human check in PR)
- [ ] Invalid drops snap back and never dispatch a partially applied move
- [ ] HP numbers and tile labels readable at arm's length on the iPad (human check; screenshot attached to PR)
- [ ] e2e drag tests pass
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

**Status:** Not Started
