# 23 — Trait Telegraph on the Board

**Milestone:** M4 · **Layer:** presentation · **Depends on:** 22 · **Branch:** `task/23-trait-telegraph`

## Task

Make each trait readable during planning without words. An untelegraphed Bounce-back robot reads as
a bug (GDD v0.6 §0, v0.7 §0). Bounce-back bar refill and blocked clonk already play from task 10 —
do **not** add M5 juice (escalation, louder celebrations).

## References

- GDD §6.2–6.4, §11.1–11.2, §12.2 (planning-phase cues) · TR §11.1
- `game/board/views/RobotView.ts`, `game/board/reconcile.ts`, `game/board/views/palette.ts`
- `data/presentation.json` (new `traits` colours live here — CLAUDE.md rule 3)

## Context

`RobotView` is one grey block with a single antenna and an HP number. Trait is on `Robot` and on
`RobotSpawned` but the view ignores it. Playback already handles `RobotBouncedBack` (bar overshoots
and settles) and `BallBlocked` (clonk). This task is the **planning-phase** silhouette.

HP remains the largest element on the robot. Trait chrome is secondary.

## Requirements

1. **`presentation.json` `traits`** — add a schema'd object (no hardcoded colours in views):

   ```json
   "traits": {
     "weaknessNColor": "#ffd54f",
     "oddShieldColor": "#7e57c2",
     "evenShieldColor": "#26a69a",
     "bounceBackBodyColor": "#ef6c00"
   }
   ```

   Hex values may be tuned in Completion Notes; the keys may not. Contrast must keep the HP
   numeral readable (GDD §11.2).

2. **`RobotView` telegraphs `robot.trait`** (and rebuilds if the trait changes — it shouldn't
   during a run, but reconcile must pass trait in). Exact shapes are the implementer's, with
   these **must-reads**:

   | Trait | Must read as |
   |---|---|
   | `none` | Today's block (one antenna). No extra chrome. |
   | `weakness` | The number **n** (2, 5, or 10) on the chest, smaller than HP, colour `weaknessNColor`. |
   | `bounceBack` | A coiled / springy silhouette (not a second HP). Body uses `bounceBackBodyColor`. |
   | `oddOnly` | One unpaired feature (single antenna or single eye) **and** a shield wash in `oddShieldColor`. |
   | `evenOnly` | Matched pairs (two antennae or two eyes) **and** a shield wash in `evenShieldColor`. |

   Wrong-parity shield colour is "what hurts it" (GDD §6.3). Do not label ODD/EVEN with letters.

3. **Tests:**
   - Unit: constructing a `RobotView` (or a small extracted `traitChrome(trait)` helper) for each
     trait type yields a distinct flag/shape — e.g. weakness exposes `n`, odd vs even expose
     different `pairCount`, bounce-back exposes `coiled: true`. Prefer a pure helper so the test
     does not need a Phaser scene if that's already painful; if the view is the only seam, use
     the existing Phaser test pattern in `tests/game/`.
   - e2e: New Run → skip to a wave-4 planning board that has the Weakness-5 robot (dispatch
     `endTurn`/`skipAnimation` as `e2e/run.spec.ts` does) → the robot's HP text is still present
     and a testid or canvas assertion shows the chest **5**. If canvas text is impractical, assert
     via a test-handle hook `getRobotChrome(robotId)` rather than inventing a DOM overlay.

4. **Legibility:** any change that makes HP harder to read is a regression (CLAUDE.md rule 6).
   Weakness `n` must not out-scale HP.

## Out of Scope

Boss overflow scale (26). Hint numbers (24). M5 bounce-back / clonk juice. Armor.

## Acceptance Criteria

- [ ] Each trait is visually distinct during planning; `none` unchanged
- [ ] Weakness shows n; odd/even show unpaired vs paired + shield colour; bounce-back is coiled
- [ ] Colours come from `presentation.json` `traits`
- [ ] HP remains the largest numeral on the robot
- [ ] `npm test`, `typecheck`, `lint`, and a targeted e2e pass
