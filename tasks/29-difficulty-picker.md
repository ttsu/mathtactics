# 29 — New Game Picker & Settings

**Milestone:** M4.5 · **Layer:** ui / state · **Depends on:** 28 · **Branch:** `task/29-difficulty-picker`

## Task

Ship the New Game difficulty picker and a Settings three-way for the last pick. Keep Going
does not ask. Presentation never changes HP or spawn counts — it only chooses the
`newRun.difficulty` already implemented in task 28.

## References

- GDD v0.8 §10.4, §10.7, §11.1, §11.8, §18.3 · TR §10 (`settings`, `screen`), §13, §14
- Task 28 Completion Notes — `newRun` payload, `RunState.difficulty`, labels/stars in
  `difficulty.json`
- `game/ui/MainMenu.tsx`, `game/ui/SettingsScreen.tsx`, `game/ui/App.tsx`
- `game/state/runFlow.ts` (`startNewRun`), `game/state/storage.ts` (`Settings`,
  `DEFAULT_SETTINGS`, `loadSettings`)
- `e2e/settings.spec.ts`, `e2e/run.spec.ts` — do not rename existing testids

## Context

A 7-year-old may never open Settings (Playtest 4 watches for this). New Game **always** opens
the picker so Easy is one tap from the menu, not a buried toggle. Last pick is remembered so
the next New Game highlights the same star. Settings exposes the same three-way so a parent
can change the default without starting a run; that write must not retcon `run.difficulty`.

Labels and star counts come from `data/difficulty.json` (task 28). Do not hardcode "Easy" in
the component if the data already has `label` / `stars`.

`RunState.mode` is still `'run' | 'level'`. Screen id for the picker is `'difficulty'`
(not `'mode'`).

## Requirements

1. **Screen** — add `'difficulty'` to the store's `screen` union. `App.tsx` renders
   `DifficultyScreen` (`game/ui/DifficultyScreen.tsx`) when `screen === 'difficulty'`. Root
   `data-testid="difficulty"`. Icon-led, no sentences.

   Three equally large buttons in a row, one per mode, each:
   - `stars` filled-star glyphs (1 / 2 / 3) plus the `label` beneath
   - `data-testid="difficulty-easy"` / `difficulty-normal` / `difficulty-hard`
   - `aria-label` = the label; `aria-pressed` true for the current default
   - tapping writes `setSettings({ difficulty })` then `startNewRun` with that difficulty

   ▶ *Home* (`data-testid="difficulty-home"`) → `'menu'`, no run started, last pick unchanged
   if they didn't tap a star. Same Home pattern as Settings (labelled ▶).

   Cover the labels: star counts must still distinguish the three (GDD §11.1).

2. **Main menu** — New Game (`menu-new-run`, both the big and the small button) calls
   `setScreen('difficulty')` instead of `startNewRun`. Keep Going is unchanged. Puzzles
   unchanged. New Game still has no confirm-replace dialog (GDD §10.4); the picker *is* the
   next tap, and starting replaces the save.

3. **`startNewRun`** — takes the difficulty (from the picker tap, or from
   `settings.difficulty` if you keep a single helper). Dispatches
   `{ type: 'newRun', seed, difficulty }` and `setScreen('game')`. Seed still minted at this
   edge (`runFlow.ts`), never in `/sim`.

4. **Settings** — a three-way control under Hints, labelled *Easy* / *Normal* / *Hard* with
   the same stars. `data-testid="settings-difficulty-easy"` (and `-normal`, `-hard`).
   `aria-pressed` on the selected one. Writes `setSettings({ difficulty })` only — does not
   dispatch `newRun`, does not mutate `run`. Default `'normal'`. No Sound row (still M5).

   Persist in the existing `settings` storage key. `loadSettings` falls back to `'normal'`
   when the field is missing (a pre-M4.5 settings blob must not wipe hints).
   `DEFAULT_SETTINGS.difficulty === 'normal'`.

5. **Keep Going / save** — a saved run resumes with its own `run.difficulty`. Changing
   Settings while a run is saved does not alter that run. e2e: start Easy → Home → change
   Settings to Hard → Keep Going → `run.difficulty` is still `'easy'`.

6. **Tests / e2e:**
   - Menu → New Game → picker visible, Normal `aria-pressed` on a fresh profile
   - Tap Easy → game screen, `run.difficulty === 'easy'`, Easy overlay actually applied
     (wave-1 HP band is the Easy band, or `getState().run.difficulty` plus a sim assertion)
   - Home from picker does not replace a saved run
   - Settings three-way persists across reload; does not change an in-progress run
   - Keep Going after Easy New Game does not show the picker
   - `e2e/run.spec.ts` New Game path goes through the picker (tap Normal) so the full-run
     e2e still plays Normal
   - Settings still has no Sound control

7. **TR §10 / §14** — `settings.difficulty`; `screen: 'difficulty'`; record the picker
   testids. No Phaser work.

## Out of Scope

Overlay formula and leftover bands (28, 30). Sound. HUD difficulty badge (GDD §18.3: none).
Per-mode shop. Confirm dialogs.

## Acceptance Criteria

- [ ] New Game always opens the picker; three star buttons; Home cancels
- [ ] Tapping a difficulty starts that run and remembers the pick
- [ ] Keep Going never asks; Settings three-way is default-only
- [ ] Pre-M4.5 settings blobs still load (hints preserved, difficulty Normal)
- [ ] Full-run e2e still plays Normal via the picker
- [ ] `npm test`, `typecheck`, `lint`, targeted e2e pass
- [ ] iPad preview check (new screen) — awaiting human
