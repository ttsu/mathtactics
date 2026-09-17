# 24 — Settings Screen & Planning Hints

**Milestone:** M4 · **Layer:** ui / board · **Depends on:** — · **Branch:** `task/24-settings-and-hints`

## Task

Ship the Settings screen (hints only) from the main menu, and draw planning hints on the board
when hints are on. `AppState.settings` and `localStorage` `settings` already exist (task 05);
there is no screen and the board never reads the flag. **No Sound row** — that waits for M5 audio.

## References

- GDD §5.7, §11.1, §11.8 · TR §10 (`settings`, `setSettings`, `screen: 'settings'`), §13,
  §14 (test handle)
- `game/state/storage.ts` (`DEFAULT_SETTINGS`: hints false, sound true)
- `game/ui/MainMenu.tsx`, `game/ui/App.tsx`, `sim/core/tiles.ts` (`applyTile`)
- `sim/commands/boardQueries.ts` (`robotAt`, `tileAt`), `game/board/BoardRenderer.ts`,
  `game/board/bindStore.ts`, `game/board/layout.ts`

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
   run is resumable. `data-testid="menu-settings"`.

2. **Settings screen** (`game/ui/SettingsScreen.tsx`, `screen === 'settings'`). Icon-led, no
   sentences:
   - **Hints** toggle (off by default). Icon should suggest a running total (e.g. `1 → 4` under
     a tile glyph), plus the label *Hints*. `data-testid="settings-hints"`, with
     `aria-pressed` reflecting the value so e2e can read state without a screenshot.
   - **Home** (or a ▶ labelled *Home*) back to `'menu'`. Same pattern as Win/Lose.
     `data-testid="settings-home"`.
   - Screen root `data-testid="settings"`. Task 27's e2e uses these four ids — do not rename
     them without updating that spec.
   - Do **not** add a Sound row.

   Toggles call `setSettings`. A reload keeps the values (`loadSettings` / `saveSettings` already
   wired). e2e: flip Hints on → reload → still on.

3. **Running totals** — a **pure** function in `/sim` (no Phaser, no React). It has to resolve
   `board.cells[lane][col]` (a `pieceId`) through `RunState.pieces` to a `TileId` and then
   through `data.tiles` to a `TileDef` before `applyTile` can run, so take the state and data
   rather than a bare board:

   ```ts
   // sim/core/hints.ts (or sim/commands/boardQueries.ts alongside robotAt/tileAt)
   export function laneHintValues(state: RunState, lane: Lane, data: GameData): number[];
   ```

   One entry per occupied tile cell in that lane that sits **strictly left of** the front-most
   **on-board** robot in that lane (a waiting robot, `col: null`, is not on the board and does
   not stop the ball), or every occupied tile cell when the lane has no robot. Walk cols 1→7
   from `state.cannonBaseValue` using `applyTile`. Empty cells contribute nothing (skip; do not
   emit a value). Unarmed lanes return `[]`; so does a lane whose robot stands on col 1.
   Presentation needs to know *which* cell each value belongs to, so either return
   `{ col, value }[]` or have the caller re-walk — pick one and say which in Completion Notes.

   Tests in `tests/sim/`: `(1) +4 ×3 −2` with a robot at col 7 → `[5, 15, 13]`; a robot standing
   on col 4 with tiles only in 1–3 → totals stop before the robot; a robot on col 1 → `[]`;
   unarmed → `[]`; a waiting robot does not truncate; `×` then `+` order; a negative running
   total is shown as it is (GDD §2.1 — never clamped). Hints **must not** consult `robot.trait`.

4. **Board draw** — while `run.phase === 'planning'`, `settings.hints === true`, and playback is
   idle, Phaser draws those numbers **under** the tiles of armed lanes. Smaller than the tile's
   own numeral (CLAUDE.md rule 6): put the font size next to the other board constants in
   `game/board/layout.ts` (`TILE_LABEL_FONT_SIZE` is the one to stay under), and any colour in
   `presentation.json` — board geometry is code, tuning colour is data. The board already
   re-renders on store changes via `bindStore`, so subscribe to `settings.hints` the same way;
   hidden during playback and outside planning. Toggling hints mid-planning (via settings, then
   Home, then Keep Going) is not required to live-update the open board — settings is a full
   screen; returning via Keep Going is a new bind. Still: if the board is showing and settings
   somehow flipped, the next sync must respect the current flag.

5. **Test handle** (TR §14) — hints are Phaser text, so a DOM testid is not an option. Add
   `getHints(): { lane: number; col: number; value: number }[]`, board-side like
   `renderedBoard()` and injected from `game/main.tsx`, returning what is drawn right now (empty
   when hints are off). Record the shape in TR §14; task 27's e2e calls it.

6. **Tests / e2e:**
   - Menu → Settings → Hints on → Home → New Game → place a tile in an armed lane → `getHints()`
     is non-empty and matches `laneHintValues` for that lane.
   - Hints off: `getHints()` is empty with the same board.
   - Hints on survives reload. No Sound control to assert.
   - A board unit test that the drawer is called when the flag is on and not when it is off.

## Out of Scope

Web Audio and the Sound row (M5). Trait chrome (23). Changing default hints to on.

## Acceptance Criteria

- [ ] Settings reachable from the main menu; Hints off by default; no Sound row
- [ ] Settings testids are `menu-settings`, `settings`, `settings-hints`, `settings-home`
- [ ] Hints toggle persists across reload
- [ ] Pure `laneHintValues` matches GDD §5.7 (no trait effects)
- [ ] Armed-lane hint numerals draw only when hints are on, during planning, smaller than tile n
- [ ] `getHints()` is on the test handle and recorded in TR §14
- [ ] `npm test`, `typecheck`, `lint`, targeted e2e pass
- [ ] iPad preview check (Settings is a new screen) — awaiting human
