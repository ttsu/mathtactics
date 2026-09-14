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

**Status:** Not Started
