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

- [x] Board reflects state for any scenario loaded via `__GAME__.loadScenario`
- [ ] Tile and cannon drags work with touch on the iPad preview (human check in PR)
- [x] Invalid drops snap back and never dispatch a partially applied move
- [ ] HP numbers and tile labels readable at arm's length on the iPad (human check; screenshot attached to PR)
- [x] e2e drag tests pass
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

**Status:** Complete (two human checks pending on the PR preview)

**Acceptance criteria:**

- [x] Board reflects state for any scenario loaded via `__GAME__.loadScenario` — `BoardScene` re-syncs on every change to `run.board`/`run.tray`/`run.pieces`/`run.cannonBaseValue` (`boardSliceChanged`); `installState` also resets playback, which triggers a re-sync. Verified by the e2e drag specs (all start from `loadScenario`) and screenshots.
- [ ] Tile and cannon drags work with touch on the iPad preview — **pending human check on PR preview.** Automated: WebKit e2e drives Phaser's TouchManager with real `TouchEvent`s (and its MouseManager with Playwright mouse events).
- [x] Invalid drops snap back and never dispatch a partially applied move — invalid targets are filtered by `resolveDrop` before dispatch; the board has no optimistic state (the held piece is handed back to the renderer, which settles it from the last synced `run`). e2e: locked/occupied drops leave `getState()` deep-equal.
- [ ] HP numbers and tile labels readable at arm's length on the iPad — **pending human check on PR preview.** Screenshot: `e2e/board-drag.spec.ts` "legibility screenshot" writes `test-results/board-drag-legibility-screenshot-of-a-loaded-board-webkit/board-legibility.png` (not committed).
- [x] e2e drag tests pass — 10 tests in `e2e/board-drag.spec.ts` (blocked drops use lane-2 targets with empty cells directly above; touch-cancel test).
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass (see Verification).

**Verification:**

- `npm test` — 29 files, 289 tests passed.
- `npm run typecheck` — clean. `npm run lint` — clean.
- `npm run build` + `npm run check:no-test-handle` — OK, no `__GAME__` in `dist`.
- `npm run test:e2e` — 23/23 (WebKit) passed.

**Deviations from spec / minor calls made:**

- **Invalid drops are rejected before dispatch** (ruling offered both): `dragTargets.resolveDrop` mirrors the planning commands' validity rules and returns a command only for a valid target. The sim still validates; if it ever rejects, nothing changes and the board re-renders from the store.
- **Drop point (fix round 1 controller ruling):** drops resolve at the **finger point**; `fingerOffsetPt` only moves where the lifted piece is drawn (`heldPieceCenter`). Finger on a cell's drawn face (cell rect inset by `CELL_INSET`, `layout.cellFaceAtPoint`): that cell alone decides — valid → command, its own origin → nothing, locked/occupied/wrong column → invalid with red tint. Finger in the tray area: board tile → `returnTile`, tray tile → nothing. Finger in the thin gutter between cell faces or just outside the grid: nearest valid (or origin) cell whose centre is within `snapRadiusCells` (0.75, schema min 0.6) on both axes; none → invalid. "Gutter" is taken to be the drawn gap between cell faces, since cell rects themselves are adjacent.
- **Touch cancel:** Phaser 4 reports TOUCH_CANCEL as `pointerup` and sets `pointer.wasCanceled` (`Pointer#touchcancel`, reset on `touchstart`); `DragController` cancels the drag (piece animates home, nothing dispatched) instead of dropping.
- **Playback gate:** one predicate, `isPlaybackActive(state)` in `game/state/store.ts`, used by drag start, `BoardScene`'s sync gate and `hudButtons`.
- **Drop feedback:** the target cell lights up white; a locked/occupied (or otherwise invalid) cell under the piece with nothing valid in reach tints red; the tray outlines when a cell tile would be returned.
- **Tray:** one row of 12 slots (64pt tiles, 70pt pitch, touch area = pitch × tray height). With more than 12 pieces it scrolls a whole slot at a time (no clipping mask needed — Phaser 4 masks are filters) with small ◀ ▶ markers. On an overflowing tray, a press on a tile waits `trayScrollThresholdPt`: mostly-horizontal movement scrolls, otherwise it drags. Dropping a tray tile back in the tray never reorders it.
- **Drag tuning in data:** `presentation.json` `drag` { `liftScale`, `liftDurationMs`, `fingerOffsetPt`, `snapRadiusCells`, `settleDurationMs`, `trayScrollThresholdPt` } with schema. Piece/font sizes (`PIECE_SIZE`, `ROBOT_SIZE`, `TRAY_*`, font sizes, `CANNON_SLOT_OUTLINE_WIDTH`) are geometry in `layout.ts`; placeholder chrome colours in `game/board/views/palette.ts` (empty cannon slots are a pale socket with a heavy slate outline; a cannon is a solid near-black block with a barrel) (tile face colours still come from `presentation.json`). Tile label text is near-black (≥ 6:1 contrast on all three tile colours); `×6`+ tiles show a small ★ (`tiles.json` `starred`).
- **Board frozen during playback:** while `playback.status === 'playing'` the board does not re-sync (TR §10 — the task-10 Director owns it then) and re-syncs when playback ends. Drags can't start while playing or outside `phase: 'planning'`. The HUD calls `finishPlayback()` straight after a successful End Turn (`// TODO(task 10)`). `__GAME__.endTurn()` does not finish playback, so the board stays on the pre-turn state until task 10's `skipAnimation`.
- **HUD:** End Turn is also disabled with no run or outside planning (not just during playback). Undo shows a bold SVG back-arrow (`aria-label="Undo"`, no reading required, GDD §11.1), 96×68pt.
- **Waiting (off-board) robots are not drawn** — they only exist from M2 (GDD §4 "ghost"); traits have no visuals until M4. A robot's block is smaller than a tile so a tile under it still shows its colour rim; its HP text shrinks to fit for 3-digit HP.
- **`cellToClient` injection:** `/game/state` can't import `/game/board`, so `createTestHandle(store, board?)`/`installTestHandle(store, board?)` take a `{ cellToClient }` from `game/main.tsx`, built from the pure `layout.cellToClient(canvasRect, cell)`. Without a board (unit tests) it throws `no board mounted`.
- **`BoardLayoutScene` removed:** its drawing became `drawBoardBackground()` (used by the new `BoardScene`); the task-03 crispness test label and `TEST_LABEL_FONT_SIZE` were dropped since real tile labels now exercise the same thing.
- **e2e touch:** Playwright has no touch-drag API and WebKit has no `Touch` constructor, so touches are built with WebKit's `document.createTouch`/`createTouchList` and dispatched as real `TouchEvent`s on the canvas.

**Design questions raised:** None.

**Known issues / follow-up:**

- Tray tile "reordering" within the tray is not supported (tray → tray = no command, per ruling).

**Files created:** `game/board/{BoardScene,BoardRenderer,DragController,dragTargets,pieces,reconcile,trayScroll}.ts`, `game/board/views/{TileView,CannonView,RobotView,palette}.ts`, `game/ui/hudButtons.ts`, `tests/helpers/dragSettings.ts`, `tests/game/{boardFixtures,dragTargets.test,boardPieces.test,reconcile.test,trayScroll.test,hudButtons.test}.ts`, `e2e/board-drag.spec.ts`

**Files modified:** `game/board/BoardLayoutScene.ts` → `game/board/drawBoardBackground.ts`, `game/board/{layout,createBoardGame,index}.ts`, `game/main.tsx`, `game/state/testHandle.ts`, `game/ui/{Hud.tsx,ui.css}`, `data/presentation.json`, `sim/data/schemas.ts`, `tests/game/{layout,testHandle,store}.test.ts`, `tests/sim/data/{load,levels}.test.ts`, `tests/sim/commands/{fixtures.ts,loadLevel.test.ts}` (fake-data fixtures use the shared `tests/helpers/dragSettings.ts`), `TASKS.md`

**Notes for next agent:**

- Task 10: `BoardScene`'s store listener already ignores changes while playing and re-syncs on `playing → idle`; remove the `finishPlayback()` TODO in `game/ui/Hud.tsx` once the Director drives it. `BoardRenderer` owns the views (tiles by `pieceId`, robots by `robotId`, cannons by lane) — the Director will likely need read access to robot/tile views for beats.
- All drag decisions are pure (`dragTargets.ts`, `trayScroll.ts`) and covered by node tests; `tests/game/boardFixtures.ts` builds states from scenario-style board rows plus real `/data`.
