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

_To be filled in by `/finish-task`._
