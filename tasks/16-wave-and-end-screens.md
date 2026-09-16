# 16 — Wave-Cleared, Win & Lose Screens

**Milestone:** M2 · **Layer:** ui · **Depends on:** 13 · **Branch:** `task/16-wave-and-end-screens`

## Task

Build the three React screens of a run: the wave-cleared overlay (with reward tiles and ▶ next wave), the
win celebration and the cheerful lose screen, both showing the run's exact-kill count.

## References

- GDD §0 (v0.4), §1.1 (pillar 4), §10.5, §10.6, §11.1, §11.4 · TR §10, §11.3

## Context

Task 13 ends a wave with phase `waveCleared` (reward tiles already in `run.tray`, `TilesGranted` in the events), and a run
with phase `won`/`lost`. Task 11's `LevelClearedOverlay` / `AllDoneScreen` are the pattern to follow (derived visibility,
SVG glyphs, `screens.popInMs`, double-tap guard). Task 14 owns switching `screen` to `won`/`lost` and clearing the save; if
14 isn't merged yet, drive the screens from the store in tests and leave the wiring to whichever lands second.

## Requirements

1. **Wave-cleared overlay:** shown when `run.mode === 'run'`, `run.phase === 'waveCleared'` and playback is idle (a pure
   `showWaveCleared(state)` helper beside `showLevelCleared`). Shows: a big star; the wave dots with the cleared wave
   filled; the reward tiles (taken from `TilesGranted` in `run.lastTurnEvents`, rendered like tray tiles with operator +
   number and category color) popping in one after another; a big **▶** that dispatches `nextWave` then hides.
   ▶ must ignore double taps (a second `nextWave` returns `wrong_phase`, but don't rely on it for UI state).
   After resume (task 14) the overlay reappears; `lastTurnEvents` is saved with the run, so rewards still show.
2. **Win screen** (`screen: 'won'`): the biggest celebration in the app so far (confetti/stars, placeholder shapes fine),
   all wave dots filled, the **exact-kill row**, big **▶** → menu.
3. **Lose screen** (`screen: 'lost'`): cheerful, no shaming — e.g. the robots doing a silly dance, a big smile — no red X,
   no "game over" imagery. Wave dots show how far the run got, the **exact-kill row**, big **▶** → menu. No other
   buttons (GDD §10.1: loss returns to the menu).
4. **Exact-kill row:** one star/robot icon per exact kill with the number beside it in large digits (numbers are allowed;
   a short label per GDD §11.1 is fine, sentences are not). Wrap or scale for large counts (a full M2 run has roughly 9–12 robots) — must stay legible.
5. Pop-in and stagger timings in `presentation.json` `screens` (e.g. `rewardStaggerMs`, `iconStaggerMs`).
6. All buttons ≥ 60 pt; no reading required to understand any screen. The ▶ buttons carry short labels per
   GDD §11.1 (v0.5): *Next* on the wave-cleared overlay, *Home* on the win and lose screens.

## Tests

- Unit: `showWaveCleared` (phase, mode, playback idle); reward tiles derived from `lastTurnEvents`.
- e2e: install a run scenario whose next End Turn clears a non-final wave → `skipAnimation()` → overlay visible with
  the reward tile count from `getState()` → tap ▶ → `getState().phase === 'planning'`, `waveIndex` +1, overlay gone.
  Final-wave scenario → win screen with exact-kill number equal to `getState().exactKills` → ▶ → menu.
  Lose scenario → lose screen → ▶ → menu. Button sizes ≥ 60 pt.
- Screenshots (not committed) of all three screens for the iPad legibility check.

## Acceptance Criteria

- [ ] Wave-cleared overlay shows reward tiles and ▶ starts the next wave
- [ ] Win and lose screens show wave progress and the exact-kill count, ▶ returns to menu
- [ ] Lose screen is cheerful (human check)
- [ ] Icon-led with short labels (GDD §11.1), ≥ 60 pt, timings in data
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

**Status:** Complete (iPad check pending)
**Completed:** 2026-09-15

**Acceptance criteria:**
- [x] Wave-cleared overlay shows reward tiles and ▶ starts the next wave — Met (`WaveClearedOverlay.tsx`,
  `showWaveCleared`, `continueToNextWave`; e2e `wave-cleared overlay shows the reward tiles…`; also reappears after a
  reload, e2e `reloading while the wave-cleared overlay is up…`)
- [x] Win and lose screens show wave progress and the exact-kill count, ▶ returns to menu — Met (`WinScreen.tsx`,
  `LoseScreen.tsx`, `ExactKillRow.tsx`; reached through the real End Turn → `finishPlayback` flow in e2e)
- [ ] Lose screen is cheerful (human check) — **Pending human check.** Big smile + three dancing robots, no red X or
  "game over" imagery, one ▶ only (e2e asserts exactly one button).
- [x] Text-free, ≥ 60 pt, timings in data — Met (SVG glyphs and digits only; e2e-measured buttons;
  `screens.rewardStaggerMs/iconStaggerMs/danceMs/danceStaggerMs` in `presentation.json`)
- [x] `npm test` (572 tests), `typecheck`, `lint`, `build`, `npm run sim -- scenarios` (31/31), `test:e2e` (57) pass — Met

**Deviations from spec:**
- **Wave dots reuse `LevelDots`** (task 11) instead of a new component; its `data-testid="level-dots"` now also appears
  on these screens.
- **The lose screen's dots don't mark the current wave cleared** — it shows as "current" (orange), not "done" (gold),
  since that wave beat the player.
- **Win-screen stars/confetti pop in as one group** (like `AllDoneScreen`); only per-item rows (reward tiles, exact
  kills, dancing robots) are staggered.
- **Reward chips have no ★ badge.** v1 wave rewards are low tiles, never a starred ×6+.
- **Tile label/colour logic is duplicated** from `game/board/pieces.ts` in `WaveClearedOverlay.tsx`: `/game/ui` may not
  import `/game/board` (TR §2). An unknown reward tile id renders a neutral grey chip instead of throwing.
- **`waveRewardTiles` returns a module-level `NO_REWARDS` singleton** for the empty case. A fresh `[]` from a Zustand
  selector caused an infinite render loop (React #185) that unmounted `#ui-root`.
- **Integration with tasks 14/15:** `showWaveCleared` also requires `screen === 'game'` (matching `showLevelCleared`);
  `hudButtons.home` calls it instead of restating the condition. The won/lost e2e tests reach the screens through task
  14's real `finishPlayback` switch, so the temporary `TestHandle.setScreen` was removed.
- **Wave-flow tests use their own waves (final review fix).** `e2e/waves.spec.ts` and `tests/game/waveFlow.test.ts`
  asserted the shipped wave-1 reward and a 3-wave run, so they would break when task 17 retunes `waves.json`. They now
  use inline `waves:` fixtures (two waves, first rewards `mul:2` + `add:4`). For that to work in the browser, the test
  handle's `loadScenario` now installs `effectiveData(scenario, shippedData)` (newly exported from `sim/scenario`) as
  the store's `data`. `loadState` restores the shipped data. Before this, a scenario's `waves:` was silently ignored in
  e2e. Verified by re-running both with a modified `waves.json` (4 waves, different wave-1 reward), then restoring it.
  The resume test still needs the shipped file to have ≥ 2 waves, because a reload drops the scenario's waves.
- **⌂ Home in `waveCleared` reverts to hidden (rebase onto main).** Task 14 shipped Home *visible* there as a deliberate
  stopgap: without this overlay nothing dispatched `nextWave`, so hiding Home stranded the player on a cleared wave.
  That is exactly the condition this task removes, so the original rule is restored and `hudButtons.home` delegates to
  `showWaveCleared`. Task 14's e2e regression test (`e2e/run-flow.spec.ts`, "never stranded in waveCleared") asserted
  the stopgap and so failed on the rebase; it was rewritten to guard the invariant that outlives both rules — a cleared
  wave always offers one live control — now the overlay's ▶, with Home asserted hidden in place.

**Architectural decisions made:**
- `game/state/waveFlow.ts`: `waveCount(data)`, `showWaveCleared(state)`, `waveRewardTiles(run)`,
  `continueToNextWave(store)` — framework-free, mirrors `levelFlow.ts`; ▶ is guarded on `phase === 'waveCleared'`.
- `App.tsx` renders `WaveClearedOverlay` inside the `screen === 'game'` block and `WinScreen`/`LoseScreen` for
  `screen === 'won'`/`'lost'`; both read `run.exactKills`/`run.waveIndex`, so `run` stays in memory after the save is
  cleared.
- New icons: `SmileIcon`, `DancingRobotIcon` (`icons.tsx`). New test ids: `wave-cleared`, `wave-next`, `reward-tile`,
  `won`, `won-menu`, `lost`, `lost-menu`, `exact-kill-count`.
- Test handle: `loadScenario` honours `waves:` for the session (TR §14).

**Known issues / follow-up needed:**
- iPad check pending: the three screens' legibility, the lose screen's tone, and the placeholder dancing-robot art (M5).
- The exact-kill row with 9–12 icons (a full M2 run) isn't covered by a test or screenshot; past roughly 20 exact kills
  the win screen would overflow (a v1-length run concern).
- `OPERATOR_GLYPH`/`rewardLabel` duplicate `game/board/pieces.ts`'s `tileFace`; could be hoisted to `/game/state`.
- The dance keyframe's easing and rotation stay in CSS (same category as `pop-in`'s curve).

**Files created:**
- `game/state/waveFlow.ts`, `game/ui/WaveClearedOverlay.tsx`, `game/ui/WinScreen.tsx`, `game/ui/LoseScreen.tsx`,
  `game/ui/ExactKillRow.tsx`
- `tests/game/waveFlow.test.ts`, `e2e/waves.spec.ts`

**Files modified:**
- `game/ui/App.tsx`, `game/ui/icons.tsx`, `game/ui/ui.css`, `game/ui/hudButtons.ts`
- `game/state/testHandle.ts`, `sim/scenario/run.ts`, `sim/scenario/index.ts` (`effectiveData` export)
- `sim/data/schemas.ts`, `data/presentation.json`, `tests/helpers/dragSettings.ts` (`screens.*` stagger/dance keys)
- `tests/game/hudButtons.test.ts`, `tests/game/testHandle.test.ts`
- `TECHNICAL_REFERENCE.md` (§10 Home/`showWaveCleared` sentence, §14 `loadScenario` waves), `TASKS.md`

**Notes for next agent:**
- Task 17: e2e and unit tests for the wave flow no longer read `waves.json` content, so retune freely. Add new run
  e2e scenarios with inline `waves:`. If the wave count changes, also retune `playback.detonate.heartTargetX` (task
  15's ♥ e2e will flag it).
- Zustand selectors in `/game/ui` must return stable references for "empty" values (see `NO_REWARDS`).
