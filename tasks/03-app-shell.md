# 03 — App Shell: Phaser + React Layering, Scaling, iPad Web Shell

**Milestone:** M0 · **Layer:** presentation · **Depends on:** 01 · **Branch:** `task/03-app-shell`

## Task

Build the application shell: Phaser canvas and React overlay stacked and aligned in a shared
1180×820 design space, crisp at 2×, with the iPad Safari web-app shell (manifest, gesture
suppression, rotate overlay) and a static, empty board layout.

## References

- GDD §3.1–3.2, §11 · TR §11, §15

## Requirements

1. DOM structure per TR §11.1. React container is `pointer-events: none`; interactive children opt in.
2. **Scaling** per TR §11.2. Decide between a `UNIT = 2` multiplier and camera zoom; document the choice
   in TR §11.2 (edit the doc) and Completion Notes. Expose a helper `designToWorld()` or equivalent.
3. `#ui-root` tracks the canvas's displayed bounds on resize/orientation change so a React element at
   design `(x, y)` sits exactly over the Phaser point `(x, y)`.
4. **Static board layout scene** (placeholder shapes only, no game state):
   - Base strip on the left; cannon slot column (col 0); 5×7 tile cells; tray strip below the grid.
   - Cells ≈ 100pt; all geometry derived from layout constants in one module (`/game/board/layout.ts`), not magic numbers
     scattered through scenes. Layout constants are code (they are geometry, not tuning), but keep them in one place.
   - A test label rendered with Phaser text at 48pt design size to verify crispness on device.
5. **React HUD placeholder:** top bar with dummy "Wave 1", "♥ 100", "🪙 0" and an End Turn button (no-op),
   positioned in design space.
6. **Web shell** per TR §15: viewport meta, apple web-app metas, `manifest.webmanifest` with relative
   `start_url`/`scope`, placeholder icons (180×180 apple-touch-icon, 192, 512), CSS gesture suppression.
7. **Rotate overlay:** React, text-free illustration (simple SVG phone-rotating icon), shown when portrait.
8. **Audio unlock hook** (no sounds yet): resume an `AudioContext` on first `pointerdown`, exported for later use.
9. e2e: at 1180×820 the canvas fills the viewport; at 820×1180 the rotate overlay is visible; the End Turn
   button's bounding box is ≥ 60pt in both dimensions.

## Out of Scope

Store wiring (05), drag/drop (09), real art.

## Acceptance Criteria

- [ ] Board layout renders letterboxed but undistorted at 1180×820, 1366×1024, and 844×390
- [ ] React HUD elements align with Phaser layout at all three sizes (e2e checks an anchor point within 2px)
- [ ] Rotate overlay appears in portrait
- [ ] Manifest and metas present; `start_url` and `scope` are relative
- [ ] No page scroll, zoom, or text selection on touch (CSS present; verified manually on iPad preview in H0)
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

**Status:** Complete
**Completed:** 2026-09-14
**PR:** #3 · Preview: https://mathtactics.timtsu.com/pr/pr-3/ (removed on merge)

**Acceptance criteria:**
- [x] Board layout renders letterboxed but undistorted at 1180×820, 1366×1024, and 844×390 — Met: `e2e/app-shell.spec.ts` asserts, per size, canvas aspect = 1180/820, fits the viewport, fills one dimension and is centred in the other; at 1180×820 the canvas is 0,0,1180×820 with a 2360×1640 backing store. Screenshots at 1180×820, 844×390 and 820×1180 reviewed by eye (not committed).
- [x] React HUD elements align with Phaser layout at all three sizes (e2e checks an anchor point within 2px) — Met: the HUD bar's bottom-left and bottom-right corners are compared with the Phaser board area's top corners (client position derived from the canvas rect + layout constants), ≤ 2px at all three sizes, plus a live 1180×820 → 844×390 resize test. Mutation-checked: forcing `scale(1)` on `#ui-root` fails the 1366×1024, 844×390 and resize tests.
- [x] Rotate overlay appears in portrait — Met: at 820×1180 the overlay is visible, covers 0,0,820×1180 and contains no text; absent at all landscape sizes.
- [x] Manifest and metas present; `start_url` and `scope` are relative — Met: e2e checks viewport/apple metas, fetches manifest (`start_url: "./"`, `scope: "./"`, standalone, landscape) and all icons (200); `e2e/subpath.spec.ts` additionally proves manifest, icons, `start_url` and `scope` all resolve inside `/pr/pr-0/`.
- [x] No page scroll, zoom, or text selection on touch — CSS present (TR §15 block in `index.html`; e2e asserts computed `position: fixed`, `overflow: hidden`, `touch-action: none`, `user-select: none` on body); checked by the human on the iPad in H0.
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass — Met (see Verification).

Also req. 9: End Turn button bounding box ≥ 60pt in both dimensions at 1180×820 — Met (e2e).
Crispness of the 48pt Phaser test label on the physical device — checked by the human on the iPad in H0.

**Verification:** `npm test` ✔ (5 files, 22 tests) · `typecheck` ✔ · `lint` ✔ · `build` ✔ (pre-existing Phaser chunk-size warning only) · `check:no-test-handle` ✔ · `test:e2e` ✔ (11 passed, WebKit: 8 app-shell, 2 subpath, 1 smoke). Ran from clean `dist`/`dist-subpath-test`.

**Deviations from spec:**
- Rotate overlay is rendered by the React tree but **portalled to `<body>`**, not inside `#ui-root`: `#ui-root` carries the design-space transform, which would shrink/offset a viewport-sized fixed overlay (a transformed ancestor becomes the containing block for `position: fixed`).
- `#ui-root` is positioned with `transform: translate(left, top) scale(s)` (one transform) rather than `left/top` + `scale`; equivalent result, single style write.
- Shared design-space constants live in **`/game/state/designSpace.ts`** (`DESIGN_WIDTH/HEIGHT`, `HUD_BAR`, `MIN_TOUCH_TARGET`, pure `placementOverCanvas()`), because the HUD needs them and `/game/ui` may not import `/game/board`. It is framework-free and both layers may import `/game/state` (TR §2). Lint tests added proving both sides may import it and the board↔ui cross-ban fires.
- The audio unlock also lives in `/game/state/audio.ts` (DOM, but no Phaser/React) since both board and UI will play sounds later. The same `AudioContext` is passed to Phaser via `audio.context` so the app never creates two contexts (iOS caps them).
- `LANE_COUNT = 5` / `COLUMN_COUNT = 8` are defined in `layout.ts` with a `TODO(task 04)` — `/sim/core/coords.ts` (`LANES`, `COLS`) doesn't exist on this branch yet.
- `apple-mobile-web-app-status-bar-style` is `black` (not `black-translucent`) so the standalone status bar doesn't overlap the top HUD bar. Also added `mobile-web-app-capable` and `apple-mobile-web-app-title`.
- Placeholder chrome colours are a `PLACEHOLDER` const in `BoardLayoutScene.ts` (art, not gameplay tuning; replaced in M5). HUD sizes/colours are in `game/ui/ui.css`.
- Fixed a task-02 leftover: `dist-subpath-test/` (built by Playwright's second webServer) was not in ESLint ignores or `.prettierignore`, so `npm run lint` failed with ~5600 errors after any local `npm run test:e2e`. Added to both.
- Added `game/vite-env.d.ts` (`vite/client` types) so CSS imports typecheck (also gives `import.meta.env` types for task 05).
- **`getAudioContext()` creates the shared `AudioContext` eagerly at first call from `game/main.tsx` module init**, not lazily on first `pointerdown` as TR §15 literally reads ("create/resume `AudioContext` on first pointerdown"). Phaser's game config (`createBoardGame`) needs a context to hand to `audio.context` at construction time, so *creation* happens up front; only *resuming* it is deferred to `installAudioUnlock`'s first-`pointerdown` listener. This matches iOS Safari's actual constraint — a page may construct an `AudioContext` freely, it just starts `suspended` and may only be `resume()`d from a user gesture — so the audible behavior TR §15 cares about (no sound plays before a gesture) is preserved even though the object itself exists earlier than the doc's wording suggests. (Flagged in the final M0 whole-branch review, finding 11 — recorded here per that review's ruling; no code change.)

**Architectural decisions made:**
- **Scaling: `UNIT = 2` multiplier, not camera zoom** (documented in TR §11.2). Phaser 4 `Text` rasterises at `resolution` 1 unless set per object — `TextStyle.resolution` 0 is forced to 1 in `Text.js` and there is no game-config default — so a 2× camera zoom would make every Text blurry unless each one calls `setResolution(2)`. With `UNIT`, a 48pt label is a 96px font drawn 1:1 into the 2360×1640 backing canvas; a forgotten conversion shows up as obviously half-size instead of subtly soft on device. Cost: pointer world coordinates are world px; use `worldToDesign()`.
- `/game/board/layout.ts` is Phaser-free (unit-tested in node and imported by e2e): design-point constants, `designToWorld`/`worldToDesign`, `WORLD_WIDTH/HEIGHT`, `BOARD_AREA`, `BASE_STRIP`, `GRID`, `TRAY`, `cellRect(lane, col)`. Layout: 88pt HUD bar on top; below it an 880×640 board (80pt base strip + 800×500 grid of 100pt cells, 20pt gap, 120pt tray) centred in the remaining area.
- `createBoardGame({ parent, audioContext, onCanvasPlaced })` in `/game/board` owns all Phaser config; it calls `onCanvasPlaced(canvas)` on `READY` and every scale `RESIZE`. `game/main.tsx` is the only file touching both layers and re-places `#ui-root` from `canvas.getBoundingClientRect()`. `#ui-root` starts `visibility: hidden` until first placement to avoid a flash of mispositioned HUD.
- Placeholder icons are generated by `scripts/generate-icons.ts` (node `zlib`, no deps) and committed in `public/icons/`.

**Design questions raised:**
- None.

**Known issues / follow-up:**
- iOS Safari (non-standalone) ignores `user-scalable=no`; `touch-action: none` on html/body should block pinch/double-tap zoom, but if H0 still sees pinch-zoom, add a `gesturestart` `preventDefault` listener.
- Bundle is still one ~1.6MB (~428KB gzip) chunk (Phaser); unchanged from task 01, no code-splitting done.
- Replace `LANE_COUNT`/`COLUMN_COUNT` with `/sim/core` `LANES`/`COLS` once task 04 merges.

**Files created:** `game/state/designSpace.ts`, `game/state/audio.ts`, `game/board/layout.ts`, `game/board/BoardLayoutScene.ts`, `game/board/createBoardGame.ts`, `game/ui/App.tsx`, `game/ui/Hud.tsx`, `game/ui/RotateOverlay.tsx`, `game/ui/ui.css`, `game/vite-env.d.ts`, `public/manifest.webmanifest`, `public/icons/{apple-touch-icon-180,icon-192,icon-512}.png`, `scripts/generate-icons.ts`, `tests/game/{layout,designSpace,audio}.test.ts`, `e2e/app-shell.spec.ts`

**Files modified:** `index.html`, `game/main.tsx`, `game/board/index.ts`, `game/ui/index.ts`, `e2e/subpath.spec.ts`, `tests/lint/layer-rules.test.ts`, `eslint.config.js`, `.prettierignore`, `TECHNICAL_REFERENCE.md` (§11.2, §15), `TASKS.md`; deleted `tests/game/.gitkeep`

**Notes for next agent:**
- Draw in Phaser with `designToWorld(designPoints)` from `/game/board/layout.ts` and take positions from its rects/`cellRect()` — never raw pixels or scattered numbers. For `__GAME__.cellToClient` (task 09): client = canvasRect.x + cellRect(...).x × (canvasRect.width / DESIGN_WIDTH). React HUD elements are positioned in design points inside `#ui-root` (1px = 1pt); anything viewport-sized must portal out of `#ui-root`.
