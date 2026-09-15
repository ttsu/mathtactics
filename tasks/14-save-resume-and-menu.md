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

_To be filled in by `/finish-task`._
