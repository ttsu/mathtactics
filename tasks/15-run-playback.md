# 15 — Run Playback: Spawn, Advance, Detonation, Danger Glow

**Milestone:** M2 · **Layer:** presentation · **Depends on:** 13 · **Branch:** `task/15-run-playback`

## Task

Extend the playback Director to perform the new run-mode event groups — advance, detonations, spawns and waiting
ghosts — and add the planning-phase danger glow, so a full run turn is legible and paced on the iPad.

## References

- GDD §0 (v0.4), §4, §7.2, §11.3, §12.2 (incl. playback steps 4–6 and "Planning-phase cues"), §12.3 · TR §6, §7, §11.3, §11.4

## Context

The Director (task 10) plays `fire:lane:*` segments and commits `CoinsChanged`/`BaseDamaged` to the HUD. Task 13 adds
groups `advance`, `detonate:<lane>`, `end`, `spawn` and events `RobotAdvanced`, `RobotDetonated`, `BaseDamaged`,
`RobotSpawned`, `RobotWaiting`, `WaveCleared`, `TilesGranted`, `RunWon`, `RunLost`. `newRun`/`nextWave` return a
`spawn`-only event list. The board is rendered from `run` in planning; during playback it must show the pre-turn
board evolving event by event (never recompute rules — everything shown comes from event payloads).

## Requirements

1. **Segments** play in event order: `fire:lane:*` → `advance` → each `detonate:<lane>` → `end` → `spawn`.
   Tap-to-skip finishes the current segment; `skipAll()` still finishes everything (TR §11.4).
2. **`advance`:** all `RobotAdvanced` robots tween one cell left **together** (`pacing.advanceDurationMs`). Robots that
   will detonate (they have a `RobotDetonated` later in this event list) lurch from col 1 into the base strip in the
   same beat and stay there, so no two robots ever overlap in a cell.
3. **`detonate:<lane>`** (one at a time): flash + screen shake at the base strip in that lane; the robot's HP number flies
   to the HUD ♥; the HUD base HP **counts down** from `hpBefore` to `max(0, hpAfter)` (commit `BaseDamaged` at the start
   of the count and animate the React number, or commit per tick — pick one, note it). Robot removed.
4. **`spawn`:** `RobotSpawned` robots drop/scale into col 7 with their HP. `RobotWaiting` robots appear as a translucent
   **ghost** with visible HP just right of col 7 in their lane (inside the existing right margin — check it fits at
   1180×820 and in letterboxed sizes). A later `RobotSpawned` for a waiting `robotId` slides the ghost into col 7 and makes
   it solid. Planning-phase rendering from `run` must also draw waiting robots (`col: null`) as ghosts (e.g. after resume).
5. **`end`:** `WaveCleared`, `TilesGranted`, `RunWon`, `RunLost` need no board beat beyond a short pause here (screens
   are task 16); `CoinsChanged(waveCleared)` commits to the HUD as usual. `TilesGranted` tiles must not appear in the
   tray until playback finishes (task 16 shows them on the wave-cleared overlay).
6. **Danger glow** (planning only, derived from `run`, no event): for each lane with an on-board robot at col 1, pulse
   the base strip in that lane red and give that robot a slight wobble. Off during playback and Replay; updates live as
   the board changes (it can't change during planning in v1, but derive it, don't cache it).
7. **Replay** of a run turn plays all of the above from the pre-turn snapshot (visual only; `commitEvent` ignored).
8. All new durations, scales, alphas and colors in `presentation.json` (e.g. `playback.beats.detonateMs`, `spawnMs`,
   `ghostAlpha`, `danger.pulseMs`, `danger.color`, `baseCountDownMs`) with schema entries.
9. **Pacing target:** a 3-lane turn with one detonation and one spawn stays within ~10–12 s; single-lane early-wave turns
   feel brisk (note measured numbers).

## Tests

- Unit (node, no Phaser): segment ordering for a run-mode event list; "will detonate" derivation from events; danger-lane
  derivation from a `RunState` (col-1 robots only, waiting robots ignored); display clamp at 0.
- e2e: install a run scenario with a col-1 robot → `getDisplay().baseHp` unchanged immediately after `endTurn`, equals
  `max(0, getState().baseHp)` after `skipAnimation()`; waiting-robot scenario → after skip, `isIdle()` and state shows the
  ghost robot (`col: null`); `newRun` spawn playback completes with `isIdle()`.
- Screenshots (not committed) of: advance beat, detonation mid-count, ghost robot, danger glow — for the iPad legibility check.

## Acceptance Criteria

- [ ] Advance, detonation (with ♥ count-down), spawn and waiting ghosts play from event payloads only
- [ ] No overlapping robots during the advance/detonate beats
- [ ] Danger glow shows during planning for col-1 lanes only
- [ ] HUD base HP never shows post-turn values before its event plays; never shows below 0
- [ ] All new timings/visual numbers in `presentation.json`
- [ ] Legible and paced on the iPad preview (human check)
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

_To be filled in by `/finish-task`._
