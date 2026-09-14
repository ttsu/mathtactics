# 10 — Playback Director

**Milestone:** M1 · **Layer:** presentation · **Depends on:** 07, 09 · **Branch:** `task/10-playback-director`

## Task

Play back a resolved turn's event list as a paced, lane-by-lane animation — ball travel with a
visible changing value, tile pops, impacts, kills, exact kills — with HUD commits following
playback, tap-to-skip per lane, Replay, and `skipAnimation` for tests.

## References

- GDD §5.6, §12.2, §12.3 · TR §7, §10, §11.4

## Requirements

1. `/game/board/playback/Director.ts` per TR §11.4. Consumes `GameEvent[]` and `presentation.json`; no game rules.
   Everything it shows must come from event payloads (never recompute values).
2. **Sequencing:** groups in order; active lane highlighted, other lanes dimmed during `fire:lane:*`.
   Unarmed lanes emit no events. A lane whose ball exits without hitting a robot plays quickly (use a shorter
   pacing value from `presentation.json`).
3. **Visual beats (placeholder quality, but all present):**
   - `BallFired`: red circle appears at the cannon with its value in large white-outlined text.
   - `BallMoved`: tween between cell centers (duration from data).
   - `BallTransformed`: brief pause, tile flash, ball scale pop, number updates old → new; pop size grows with `chainDepth`.
   - `RobotDamaged`: robot knockback + damage number flies off; HP text counts to `hpAfter`; small screen shake scaled by damage.
   - `RobotDefeated` (normal): robot pops away.
   - `RobotDefeated` (exact): **distinct** placeholder celebration (e.g. star burst + big "EXACT!"-style glyph burst, not
     reliant on reading) — clearly bigger than a normal kill.
   - `RobotBouncedBack`: HP bar visibly refills with a springy wobble.
   - `BallBlocked`: ball bounces off with a clonk-style shake.
   - `BallExited`: ball rolls off the right edge.
4. **HUD commits:** on `CoinsChanged` (and later `BaseDamaged`, `WaveCleared`) call `store.commitEvent`.
   The HUD must not show post-turn values before the event plays (e2e-checkable via `getDisplay()` mid-playback).
5. **Skip:** tap anywhere on the canvas during playback → finish the current group instantly (final sprite states);
   next tap skips the next group. `skipAll()` finishes everything.
6. **Replay:** HUD button (enabled in planning when `lastTurnEvents` non-empty) re-plays the last turn from a snapshot
   of the pre-turn board, then restores the current board. Visual only; dispatches nothing.
7. On completion → `finishPlayback()`; board re-syncs from `run`.
8. Implement `__GAME__.skipAnimation()` and `isIdle()`.
9. Pacing target (GDD §12.2): ~2–3 s per active lane with 3 tiles; all timings in `presentation.json`.

## Tests

- Unit (node, no Phaser): grouping/ordering helper — given events, returns playback segments in the right order.
- e2e: load scenario, `endTurn`, assert `getDisplay().coins` unchanged immediately, then after `skipAnimation()` equals
  `getState().coins`; `isIdle()` true after skip.

## Acceptance Criteria

- [x] Every event type from task 07 has a visible beat
- [x] Exact kill is visibly distinct and bigger than a normal kill
- [ ] Ball value is readable in motion on the iPad preview (human check)
- [x] HUD values lag until their events play
- [x] Tap-to-skip per lane and Replay work
- [x] No timing constants in code (all from `presentation.json`)
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

**Status:** Complete (one human check pending on the PR preview)

**Acceptance criteria:**

- [x] Every event type from task 07 has a visible beat — `SegmentPlayer`: LaneStarted (lane highlight + other lanes dimmed + cannon thump), BallFired (red ball grows in at the cannon with its value), BallMoved (linear tween cell to cell; stops against a robot's face when the next event is an impact), BallTransformed (tile flash + tile pop, ball value updates to `newValue`, ball pop growing with `chainDepth` up to a cap), RobotDamaged (ball squashes away, robot knockback, `−damage` flies up — bigger/orange when `doubled` — HP text and bar count to `hpAfter`, camera shake scaled by `damage`), RobotBouncedBack (bar springs back with `Elastic` ease, text counts up, robot wobble), RobotDefeated (normal: puff ring + pop away), BallBlocked (ball bounces back and fades, grey shield ring, robot side-shake, small shake), BallExited (ball rolls off to the right, spinning and fading), CoinsChanged (HUD commit + `+N` coin float at the kill cell), LaneEnded (ball cleared). `LevelCleared` has no beat (ruling; task 11 adds the overlay).
- [x] Exact kill is visibly distinct and bigger — big spinning gold star, 12-star burst, expanding gold shock ring, bigger pop, larger/longer shake, 1000 ms vs 320 ms. Screenshot in the report.
- [ ] Ball value readable in motion on the iPad — **pending human check on PR preview.** Ball is a 64pt red circle, 44pt bold white number with a 6pt dark outline (shrinks to fit long values).
- [x] HUD values lag — `CoinsChanged` is committed when its beat plays (or when its segment is skipped). e2e: `getDisplay().coins` unchanged right after `endTurn()`, lane-0 reward lands while later lanes are still playing, all rewards after natural completion or `skipAnimation()`.
- [x] Tap-to-skip and Replay — e2e: each canvas tap finishes exactly one lane (coins step 0 → 2 → 4), taps and presses held across the end of playback never dispatch a drag; Replay button replays with state and display unchanged and is disabled during playback/replay.
- [x] No timing constants — all beat durations, scales, distances, shake intensities, star counts in `presentation.json` (`pacing` + new `playback` block, schema in `sim/data/schemas.ts`). Code only holds geometry (`layout.ts`), placeholder colours (`palette.ts`) and the `SHARE` fractions that split one beat's data-driven duration among its sub-animations.
- [x] Verification: `npm test` (310), `typecheck`, `lint`, `build`, `check:no-test-handle`, `test:e2e` (28) all pass.

**Deviations from spec / minor calls made:**

- **Structure:** `game/board/playback/segments.ts` (pure grouping: `toSegments`, `isHudEvent`, `bouncesBack`, `lastCellBefore`), `timeline.ts` (pure beat timing: `planPlayback`/`planSegment`/`beatDurationMs`), `SegmentPlayer.ts` (draws one segment's beats; `finish()` stops everything it started and applies every event's final state idempotently), `Director.ts` (sequencing, lane wash, skip, stop, completion), `effects.ts` (star/ring/floating text), `views/BallView.ts`.
- **Beats are sequential:** each event holds the sequence for its beat duration (`playback.beats.*`, `pacing.ballCellDurationMs`/`perTilePauseMs`); 0 ms for events without a beat. Real data: a 3-tile lane with a normal kill at column 7 = 2850 ms (unit-tested 2–3 s); an exact kill adds ~700 ms.
- **Quick exit lanes:** new `pacing.exitBallCellDurationMs` (60 ms vs 160 ms per cell) for a segment containing `BallExited`; tile pops keep their normal pause.
- **Lane gap** is a lead-in before every lane segment but the first (none before `end`), so a tap during the gap skips the upcoming lane rather than being wasted.
- **Tap to skip is on `pointerup`:** the press happened during playback, so `DragController` already ignored it, and the release that ends playback can't become a drag. A tap during the `end` segment's single frame is harmless.
- **Store:** `playback.status` gains `'replaying'`; `isPlaybackActive` = status ≠ idle. New `lastTurn: { before, events } | null` set when a dispatch yields events, kept after playback, dropped when a command installs a run whose `lastTurnEvents` isn't that array (e.g. `loadLevel`) and by the test handle's `loadState`/`loadScenario`. `canReplay` = planning, idle, `lastTurnEvents` non-empty, snapshot held. `startReplay()` sets `replaying`; `commitEvent` is a no-op while replaying (store-level guarantee, tested); `finishPlayback` re-derives display. TR §10/§11.4 updated.
- **Replay after reload:** no snapshot is persisted, so Replay is disabled after a reload until the next turn.
- **Replay board:** `BoardScene` syncs the renderer to `lastTurn.before` whenever a new playback starts (turn or replay) and back to `run` when it goes idle. Planning moves made after the turn visibly settle back to the pre-turn board for the replay.
- **Bounce-back HP display:** on an overshoot the damage beat drains the bar/text to 0 and the `RobotBouncedBack` beat springs them to `hpAfter` (`RobotDamaged.hpAfter` is already post-bounce, so counting straight to it would hide the refill). For a normal overkill the HP text counts to the (negative) `hpAfter` before the robot pops away.
- **HP bar added to `RobotView`** (thin bar under the block, always shown) so the bounce-back refill is "legible from the bar alone" (GDD §6.2). HP text remains the largest text.
- **Ball text** is white with a dark outline (matching robot HP) rather than dark text with a white outline — best contrast on the red ball; read "white-outlined" as "white, outlined".
- **Coin float** appears at the cell of the last located event before `CoinsChanged` (the event carries no cell).
- **Test handle:** `TestHandleBoard` gains `skipAnimation()`/`isAnimating()` (from `createBoardGame`, which now returns `{ game, skipAnimation, isAnimating }`). `skipAnimation()` calls the Director's `skipAll()` and falls back to `finishPlayback()` if playback is still active (no board mounted). `isIdle()` = playback idle and Director not busy (it's busy exactly while a segment is active; all its tweens/timers are segment-scoped and removed on finish).
- **HUD:** End Turn just dispatches (TODO shim removed); new Replay icon button (circular arrow + play triangle, `aria-label="Replay"`, 96×68pt, teal); icon-button CSS shared with Undo.
- **Fixtures:** `tests/helpers/playbackSettings.ts` (`fakePacingSettings`, `fakePlaybackSettings`) used by every hand-built `GameData` fixture, like `dragSettings.ts`.
- **e2e:** `e2e/board-drag.spec.ts` End Turn test now asserts not-idle, then `skipAnimation()`, then idle; test-handle unit test for `skipAnimation` throwing replaced.

**Design questions raised:** None.

**Known issues / follow-up:**

- Sound, trails, rising pitch and art are M5. `advanceDurationMs` is still unused (no advance in M1).
- Camera shake shakes the whole Phaser canvas including the tray (the React HUD does not move).

**Files created:** `game/board/playback/{Director,SegmentPlayer,segments,timeline,effects}.ts`, `game/board/views/BallView.ts`, `tests/game/{playbackSegments,playbackTimeline}.test.ts`, `tests/helpers/playbackSettings.ts`, `e2e/playback.spec.ts`

**Files modified:** `data/presentation.json`, `sim/data/schemas.ts`, `game/state/{store,testHandle,index}.ts`, `game/board/{BoardScene,BoardRenderer,createBoardGame,index,layout}.ts`, `game/board/views/{RobotView,TileView,palette}.ts`, `game/main.tsx`, `game/ui/{Hud.tsx,hudButtons.ts,ui.css}`, `tests/game/{store,testHandle,hudButtons}.test.ts`, `tests/sim/commands/{fixtures.ts,loadLevel.test.ts}`, `tests/sim/data/{load,levels}.test.ts`, `e2e/board-drag.spec.ts`, `TECHNICAL_REFERENCE.md`, `TASKS.md`

**Notes for next agent:**

- Task 11: show the level-cleared overlay when `run.phase === 'levelCleared'` **and** `!isPlaybackActive(state)` — the kill beat plays first. Replay is disabled outside planning.
- New beats for M2 events: add a duration case in `timeline.beatDurationMs`, a draw case in `SegmentPlayer.play`, and a final-state case in `SegmentPlayer.finish`. HUD events already commit via `isHudEvent`.
