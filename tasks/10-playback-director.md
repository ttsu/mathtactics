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

- [ ] Every event type from task 07 has a visible beat
- [ ] Exact kill is visibly distinct and bigger than a normal kill
- [ ] Ball value is readable in motion on the iPad preview (human check)
- [ ] HUD values lag until their events play
- [ ] Tap-to-skip per lane and Replay work
- [ ] No timing constants in code (all from `presentation.json`)
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

**Status:** Not Started
