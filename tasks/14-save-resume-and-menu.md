# 14 — Save/Resume, Main Menu & Home

**Milestone:** M2 · **Layer:** state / ui · **Depends on:** 13 · **Branch:** `task/14-save-resume-and-menu`

## Task

Make runs startable, resumable and leavable: a main menu with ▶ Continue / New Run / Puzzles, correct autosave
scoping (runs saved, puzzles never), resume into the right screen, save cleared at the end of a run, and a HUD
⌂ Home button.

## References

- GDD §0 (v0.4), §10.1, §10.4, §11 · TR §10 (incl. "M2 run flow"), §13, §14

## Context

Today the store saves **every** successful dispatch to the `run` key, including `loadLevel` — so a puzzle overwrites a
saved run. The menu (task 11) has only ▶ Play (puzzles). `loadRun` already discards mismatched `schemaVersion`
(now 2, task 12). Playback screens for wave-cleared/win/lose are task 16; the board beats are task 15. This task
must work with placeholder screens if 16 isn't merged (switching `screen` to `'won'`/`'lost'` is enough).

## Requirements

1. **Persistence scoping** (TR §13): `dispatch` saves only when the resulting state is `mode: 'run'`. A level-mode
   dispatch never writes or removes `run`. Add `clearRun(storage, basePath)`.
2. **`/game/state/runFlow.ts`** (framework-free, unit-tested), mirroring `levelFlow.ts`:
   - `resumableRun(storage…)` / a store selector: a saved run is resumable iff `mode === 'run'` and phase is
     `planning` or `waveCleared`. Continue must still work after playing Puzzles in the same session (the in-memory
     `run` was replaced by a level) — read from storage, or keep a memory copy; either is fine, note which.
   - `continueRun`: install the saved run, `screen: 'game'`, `display` from run, no playback, `lastTurn: null`
     (Replay disabled after resume, TR §11.4).
   - `startNewRun`: `dispatch({ type: 'newRun', seed })` with the seed made at the edge (clock/crypto — never in `/sim`),
     `screen: 'game'`. The returned spawn events play back like any resolution. Make sure `lastTurn` is **not** set
     from the previous run for `newRun`/`nextWave` (Replay stays off until the first End Turn).
   - `goHome`: `screen: 'menu'`; allowed only when playback is idle.
   - End of run: when playback finishes and `run.phase` is `won`/`lost` → `screen: 'won'`/`'lost'` and `clearRun`.
     A save found with phase `won`/`lost` on boot is not resumable and is cleared.
   - On boot the app opens on `menu` (unchanged); never auto-resumes.
3. **Main menu** (React): big **▶ Continue** only when resumable; **New Run** (big ▶ when there is nothing to continue,
   smaller otherwise); smaller **Puzzles** → existing level flow. Text-free glyphs (SVG, as task 11), all ≥ 60 pt.
   Distinguish New Run from Continue and Puzzles by shape/icon, not words (e.g. ▶ with a robot vs ✚ vs a tile chip);
   note the choice.
4. **HUD in run mode:** wave shown as dots (reuse `LevelDots`; count = `waves.json` length, current = `waveIndex`)
   instead of "Wave N" text; ♥ base HP clamped at 0 for display. Level mode unchanged.
5. **⌂ Home button** in a HUD corner, ≥ 60 pt, shown in both run and level mode during planning; hidden during
   playback and while the wave-cleared overlay is up. No confirmation.
6. **Test handle:** `loadState` stays storage-free (it installs state without saving); document this in TR §14.

## Tests

- Store/unit: level dispatches never touch `run` in storage; run dispatches save; `clearRun` on won/lost after
  `finishPlayback`; won/lost save on boot → not resumable and removed; schema-mismatch save ignored.
- `runFlow`: Continue after Puzzles restores the saved run; Continue into `waveCleared` restores that phase;
  New Run replaces a saved run; `goHome` refused during playback.
- e2e (WebKit iPad): New Run → robot visible (`getState().board.robots.length > 0`) → End Turn → reload page →
  menu shows Continue → Continue → same `getState()` as before reload; Puzzles → ⌂ Home → Continue still offered;
  reload mid-playback → Continue lands in planning with the resolved state; all menu/HUD buttons ≥ 60 pt.

## Acceptance Criteria

- [ ] Runs autosave after every command; puzzles never touch the save
- [ ] Menu offers ▶ Continue only for a resumable run; New Run and Puzzles always
- [ ] Reload at any point (planning, mid-playback, wave-cleared) resumes without lost progress
- [ ] Won/lost runs are cleared; Continue disappears
- [ ] ⌂ Home returns to the menu from a run or a puzzle
- [ ] Text-free, ≥ 60 pt buttons, verified on the iPad preview
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

**Status:** Complete (iPad check pending)
**Completed:** 2026-09-15

**Acceptance criteria:**
- [x] Runs autosave after every command; puzzles never touch the save — Met (`dispatch` saves only a `mode: 'run'`
  result; `tests/game/store.test.ts` "persistence scoping"; e2e "Puzzles never touches the saved run")
- [x] Menu offers ▶ Continue only for a resumable run; New Run and Puzzles always — Met (`game/ui/MainMenu.tsx`,
  `canContinue`)
- [x] Reload at any point (planning, mid-playback, wave-cleared) resumes without lost progress — Met (e2e: planning
  and mid-playback in `e2e/run-flow.spec.ts`; `continueRun` restores `waveCleared` in `tests/game/runFlow.test.ts`;
  the resume-into-overlay e2e lands with task 16)
- [x] Won/lost runs are cleared; Continue disappears — Met (`finishPlayback` + boot check; e2e "a lost run is cleared")
- [x] ⌂ Home returns to the menu from a run or a puzzle — Met (e2e)
- [ ] Text-free, ≥ 60 pt buttons, verified on the iPad preview — **Pending human check.** All menu/HUD buttons are SVG
  glyphs and e2e-measured ≥ 60 pt (`big-button` 260×150, `small-button` 140×100, HUD 96×68).
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass — Met

**Deviations from spec:**
- **End-of-run switch lives in `store.ts`'s `finishPlayback`, not `runFlow.ts`.** Both the Director and the test
  handle's `skipAnimation` call `finishPlayback` directly, and routing it through `runFlow.ts` would make a
  store↔runFlow import cycle. A private `isFinishedRun(run)` guard is used there and on boot (a won/lost save is cleared
  and not installed).
- **Continue-after-Puzzles uses a memory copy, not a storage read.** `AppState.savedRun` mirrors the `run` storage key:
  every `mode: 'run'` dispatch updates both; a level-mode dispatch touches neither; it is nulled when a run ends.
  Reading storage from `runFlow.ts` would have meant exposing `storage`/`basePath` outside the store.
- **Home's hide condition is `run.mode === 'run' && run.phase === 'waveCleared'` (plus playback).** Level mode's
  `levelCleared` isn't included; task 11's overlay already paints over the whole HUD there.
- **⌂ Home hides in place (final review fix).** It was unmounted during playback, which slid the dots/♥/🪙 about 136 pt
  left at every End Turn and back at the end. It now stays in the row with `visibility: hidden`, `disabled`,
  `aria-hidden` and `tabIndex -1`.
- **`display` is set from the new state for `newRun`/`nextWave` (final review fix).** Their spawn-only events carry no
  HUD events, so after a lost run the HUD kept showing ♥ 0 and the old 🪙 until playback finished. For `nextWave` the
  values are unchanged except `waveIndex`.
- **Menu glyphs (req. 3):** Continue = plain ▶ `PlayIcon`; New Run = `RobotPlayIcon` (▶ with a robot head); Puzzles =
  `TileChipIcon` (colour chip with "×"). New Run is the big standalone button when there is nothing to continue.
- **Seed format:** `` `run:${Date.now()}:${random}` `` (`crypto.randomUUID()`, falling back to `Math.random`), made in
  `runFlow.ts`. The GDD doesn't specify a format.

**Architectural decisions made:**
- `game/state/runFlow.ts`: `isResumable(run)`, `canContinue(state)`, `continueRun(store)`, `startNewRun(store)`,
  `goHome(store)` — framework-free, mirrors `levelFlow.ts`.
- `game/state/storage.ts`: `clearRun(storage, basePath)`.
- `AppState.savedRun: RunState | null` (see above). `dispatch` never seeds `lastTurn` for `newRun`/`nextWave`
  (`freshPhase`), so Replay stays off until the first End Turn.
- `HudButtons.home: boolean` in `hudButtons.ts`; `HomeIcon` in `Hud.tsx`; `RobotPlayIcon`, `TileChipIcon` in `icons.tsx`.
- e2e test ids: `menu-continue`, `menu-new-run`, `menu-puzzles` (replacing `menu-play`), `home`.
- `loadState`/`loadScenario` stay storage-free and never touch `savedRun` (documented in TR §14).

**Known issues / follow-up needed:**
- On this branch alone, New Run still plays its spawn over the previous board (robots and tray tiles from the last
  run or puzzle) until playback ends, because nothing re-syncs the board first. Fixed on task 15, which owns the board
  playback (pre-playback `playback.before` snapshot).
- The HUD's wave dots read `run.waveIndex`, not `display.waveIndex`, so they update at the start of playback.
- `.small-button` CSS duplicates `.big-button`'s structure.
- No test for a reload during the final won/lost playback beats.
- The HUD ♥ is clamped at render here; task 15's integration makes the store the single clamp source.

**Files created:**
- `game/state/runFlow.ts`, `tests/game/runFlow.test.ts`, `e2e/run-flow.spec.ts`

**Files modified:**
- `game/state/storage.ts`, `game/state/store.ts`
- `game/ui/MainMenu.tsx`, `game/ui/Hud.tsx`, `game/ui/hudButtons.ts`, `game/ui/icons.tsx`, `game/ui/ui.css`
- `e2e/app-shell.spec.ts`, `e2e/levels.spec.ts` (`menu-play` → `menu-puzzles`)
- `tests/game/store.test.ts`, `tests/game/hudButtons.test.ts`, `tests/game/testHandle.test.ts`
- `TECHNICAL_REFERENCE.md` (§10 `savedRun` and the M2 run flow, §14 `loadState` stays storage-free), `TASKS.md`

**Notes for next agent:**
- Continue reads `savedRun`, never `run`. Anything that ends or replaces a saved run must keep `savedRun` and the
  storage key in step.
- Keep ⌂ Home mounted: task 15's detonation number flies to a fixed ♥ position in `presentation.json`, which
  is only valid while the HUD row doesn't reflow.
- `hudButtons.home` restates task 16's `showWaveCleared` condition; switch it to call `showWaveCleared` when both exist.
