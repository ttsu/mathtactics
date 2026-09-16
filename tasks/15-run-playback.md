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

**Status:** Complete (iPad check pending)
**Completed:** 2026-09-15

**Acceptance criteria:**
- [x] Advance, detonation (with ♥ count-down), spawn and waiting ghosts play from event payloads only — Met
  (`SegmentPlayer` beat handlers; `detonatingRobots(events)` derives who lurches)
- [x] No overlapping robots during the advance/detonate beats — Met by construction (every mover and detonator shares
  one `advance` beat starting at 0 ms); frame-level check is part of the iPad review
- [x] Danger glow shows during planning for col-1 lanes only — Met (`dangerLanes(run)`, `tests/game/danger.test.ts`)
- [x] HUD base HP never shows post-turn values before its event plays; never shows below 0 — Met (e2e
  `a col-1 detonation counts the HUD base HP down…`; store clamps in `commitEvent` and `displayFromRun`)
- [x] All new timings/visual numbers in `presentation.json` — Met (`playback.beats.detonateMs/baseCountDownMs/spawnMs/
  endMs`, `playback.detonate.*`, `playback.spawn.*`, `danger.*`), except the flash colour (see Deviations)
- [ ] Legible and paced on the iPad preview (human check) — **Pending human check.** Screenshots from the
  `legibility screenshots` e2e go to `test-results/` (advance beat, detonation mid-count, ghost robot, danger glow).
- [x] `npm test` (558 tests), `typecheck`, `lint`, `build`, `test:e2e` (53) pass — Met

**Deviations from spec:**
- **HUD ♥ count-down commits per tick** (req. 3's choice): `baseDamaged` ticks `commitEvent` every frame with the
  rounded value, and `finish()` always re-commits the exact clamped final value, so a skip can't leave a stale number.
  No `Hud.tsx` change needed for the count-down.
- **`displayFromRun` clamps `baseHp` at 0.** Every "derive display from run" path goes through it; without the clamp a
  naturally finished detonation snapped the HUD to the raw negative value. The integration with task 14 removed the
  HUD's own render clamp, so the store is the single clamp source.
- **An `advance` segment is synthesised** before the first `detonate:<lane>` when nothing moved (every robot already on
  col 1), so the lurch into the base still has a beat.
- **Flash colour** `PLACEHOLDER.detonateFlash` stays in `game/board/views/palette.ts` with the other placeholder effect
  colours (M5 art pass), not in `presentation.json`.
- **Ghost fit:** `waitingGhostCenter(lane)` is one cell right of col 7 (x = 1080 design pt, robot spans 1042–1118,
  grid edge 1030, design width 1180). Letterboxing never rescales the design space (TR §11.2), so it always fits.
- **Every sequence starts from `playback.before` (final review fix).** New Run played its spawn over the previous
  run's or puzzle's board: nothing re-synced the board because `lastTurn` is null for `newRun`, so old robots and tray
  tiles stayed drawn, and a leftover `robot:0` made the new `robot:0` slide in from the old cell. The store now sets
  `Playback.before` for every sequence: the previous run for a normal turn, `lastTurn.before` for Replay, and for
  `newRun`/`nextWave` `sequenceStart(...)` = the new run minus the robots its own spawn events introduce. `BoardScene`
  syncs to it before playing. This replaces the old `lastTurn.events === playback.events` check. For `nextWave` the
  result was verified equal to the wave-cleared board (a unit test), so its behaviour is unchanged.
- **`detonate.heartTargetX/Y` retuned to (295, 44)** — the ♥ glyph's measured centre (e2e) now that task 14's ⌂ Home
  no longer unmounts during playback. It was (200, 40), tuned to the shifted row. **No fixed ♥ slot:** the wave dots
  sit left of ♥, so ♥ moves if `waves.json` changes length (each dot is 26 pt). Instead of reserving width for 10
  waves (a wide empty gap during M2's 3), an e2e test measures the ♥ glyph and fails if it is more than 6 pt from the
  target, so a wave-count change flags the retune.
- **Test handle gains `renderedBoard()`** (robot view centres in client coordinates, tile piece ids) so e2e can
  inspect the board mid-playback. Documented in TR §14.

**Architectural decisions made:**
- New exports: `detonatingRobots(events)` (`segments.ts`), `dangerLanes(run)` (`playback/danger.ts`), `DangerGlow`
  (`playback/DangerGlow.ts`), `BoardRenderer.ensureRobotView(robotId)` and `BoardRenderer.drawn()`,
  `baseStripRect/baseStripCenter/waitingGhostCenter` and `designToClient` (`layout.ts`), `sequenceStart(previous,
  next, events, freshPhase)` and `Playback.before?` (`game/state/store.ts`).
- `BoardRenderer.syncRobots` draws every robot, including waiting ones (`col: null`) as ghosts, so planning after a
  resume shows ghosts without special handling.
- `DangerGlow.sync(run)` recomputes from `run` each call; `BoardScene` passes `null` during playback/Replay. It restarts
  tweens only when the lane set changes.
- The Phaser number can't target the React ♥ directly (TR §11.1), so the target is a design point in data.

**Pacing (req. 9, measured with `planPlayback` on real data):**
- 3 armed lanes (one a 3-tile chain) + an unarmed lane's detonation + a spawn: **8.51 s**.
- Single-lane early-wave exact kill, no detonation or spawn: **2.88 s**.

**Known issues / follow-up needed:**
- iPad check pending: legibility of the advance beat, detonation mid-count and ghosts; no frame-level robot overlap.
- `PLACEHOLDER.detonateFlash` lives in `palette.ts`, not `presentation.json` (M5 art pass).
- `DangerGlow.sync` returns early when the lane set is unchanged, including right after a `loadState` that swaps in
  different robots on the same lanes (the wobble stays on the old views until the set changes).
- `SegmentPlayer.finish()`'s `BaseDamaged` re-commit clamps again, which is redundant with the store clamp (harmless).
- If `waves.json` changes length, retune `heartTargetX` (the ♥ e2e will fail and say so).

**Files created:**
- `game/board/playback/danger.ts`, `game/board/playback/DangerGlow.ts`
- `tests/game/danger.test.ts`, `e2e/run-playback.spec.ts`

**Files modified:**
- `game/board/playback/segments.ts`, `game/board/playback/timeline.ts`, `game/board/playback/SegmentPlayer.ts`
- `game/board/BoardRenderer.ts`, `game/board/BoardScene.ts`, `game/board/layout.ts`, `game/board/index.ts`,
  `game/board/createBoardGame.ts`, `game/board/views/palette.ts`, `game/main.tsx`
- `game/state/store.ts`, `game/state/testHandle.ts`, `game/ui/Hud.tsx` (render clamp removed at integration)
- `sim/data/schemas.ts`, `data/presentation.json`
- `tests/game/boardFixtures.ts`, `tests/game/playbackSegments.test.ts`, `tests/game/playbackTimeline.test.ts`,
  `tests/game/store.test.ts`, `tests/game/testHandle.test.ts`, `tests/helpers/playbackSettings.ts`
- `tests/sim/commands/fixtures.ts`, `tests/sim/commands/loadLevel.test.ts`, `tests/sim/data/{load,levels,waves}.test.ts`
  (`danger: fakeDangerSettings()` in hand-built presentation fixtures)
- `TECHNICAL_REFERENCE.md` (§10 `playback.before` and flow step 2, §11.4, §14 `renderedBoard`), `TASKS.md`

**Notes for next agent:**
- Any new command that starts a playback must set `playback.before` to where the board should start; otherwise the
  board plays over whatever it last drew.
- `run.tray` already holds `TilesGranted` pieces when the turn resolves; the tray only shows them once playback ends
  because `renderer.sync(run)` runs only when idle. Keep that gate.
- Use `renderedBoard()` for mid-playback e2e assertions; screenshots stay for legibility only.
