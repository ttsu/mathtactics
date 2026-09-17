# 24 — Settings Screen & Planning Hints

**Milestone:** M4 · **Layer:** ui / board · **Depends on:** — · **Branch:** `task/24-settings-and-hints`

## Task

Ship the Settings screen (hints only) from the main menu, and draw planning hints on the board
when hints are on. `AppState.settings` and `localStorage` `settings` already exist (task 05);
there is no screen and the board never reads the flag. **No Sound row** — that waits for M5 audio.

## References

- GDD §5.7, §11.1, §11.8 · TR §10 (`settings`, `setSettings`, `screen: 'settings'`), §13
- `game/state/storage.ts` (`DEFAULT_SETTINGS`: hints false, sound true)
- `game/ui/MainMenu.tsx`, `game/ui/App.tsx`, `sim/core/tiles.ts` (`applyTile`)

## Context

Hints are a running total under each tile in an **armed** lane, up to and including the last tile
before the first robot: `1 → 5 → 25 → 22`. They never show trait effects, blocked/doubled damage,
or the outcome (GDD §5.7, grill A). Off by default (grill A).

**No Sound toggle** (grill A). A 7-year-old tapping a mute that changes nothing will think
Settings is broken. Leave `settings.sound` in storage defaulting on for M5.

`screen: 'settings'` is already on the union; `App.tsx` does not render it.

## Requirements

1. **Main menu** — a gear control, smaller than New Game / Keep Going, labelled **Settings**
   (GDD v0.7 §18.2). `setScreen('settings')`. Does not touch `run`. Available whether or not a
   run is resumable.

2. **Settings screen** (`game/ui/SettingsScreen.tsx`, `screen === 'settings'`). Icon-led, no
   sentences:
   - **Hints** toggle (off by default). Icon should suggest a running total (e.g. `1 → 4` under
     a tile glyph), plus the label *Hints*.
   - **Home** (or a ▶ labelled *Home*) back to `'menu'`. Same pattern as Win/Lose.
   - Do **not** add a Sound row.

   Toggles call `setSettings`. A reload keeps the values (`loadSettings` / `saveSettings` already
   wired). e2e: flip Hints on → reload → still on.

3. **Running totals** — a **pure** function in `/sim` (no Phaser, no React), e.g.
   `laneHintValues(board, lane, baseValue, tilesById): number[]`, one entry per occupied tile
   cell in that lane that sits **strictly left of** the front-most robot (or all tile cells if
   the lane has no robot). Walk left to right from the cannon using `applyTile`. Empty cells
   contribute nothing (skip; do not emit a value). Unarmed lanes return `[]`.

   Tests in `tests/sim/`: `(1) +4 ×3 −2` with a robot at col 7 → `[5, 15, 13]`; a robot standing
   on col 4 with tiles only in 1–3 → totals stop before the robot; unarmed → `[]`; `×` then `+`
   order. Hints **must not** consult `robot.trait`.

4. **Board draw** — while `run.phase === 'planning'`, `settings.hints === true`, and playback is
   idle, Phaser draws those numbers **under** the tiles of armed lanes. Smaller than the tile's
   own numeral (CLAUDE.md rule 6). Hidden during playback and outside planning. Toggling hints
   mid-planning (via settings, then Home, then Keep Going) is not required to live-update the
   open board — settings is a full screen; returning via Keep Going is a new bind. Still: if the
   board is showing and settings somehow flipped, reconcile should respect the current flag.

5. **Tests / e2e:**
   - Menu → Settings → Hints on → Home → Keep Going or New Game → an armed lane with a tile
     shows a hint number (testid on a DOM overlay is **not** allowed — hints live in Phaser;
     use a test-handle `getHints(): { lane, col, value }[]` or assert the sim function from a
     board fixture plus a board unit test that the drawer is called when the flag is on).
   - Hints off: no hint draw.
   - Hints on survives reload. No Sound control to assert.

## Out of Scope

Web Audio and the Sound row (M5). Trait chrome (23). Changing default hints to on.

## Acceptance Criteria

- [ ] Settings reachable from the main menu; Hints off by default; no Sound row
- [ ] Hints toggle persists across reload
- [ ] Pure `laneHintValues` matches GDD §5.7 (no trait effects)
- [ ] Armed-lane hint numerals draw only when hints are on, during planning, smaller than tile n
- [ ] `npm test`, `typecheck`, `lint`, targeted e2e pass
