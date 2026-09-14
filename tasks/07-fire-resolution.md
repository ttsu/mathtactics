# 07 — Fire Resolution & Impact

**Milestone:** M1 · **Layer:** sim · **Depends on:** 04 · **Branch:** `task/07-fire-resolution`

## Task

Implement the FIRE step of turn resolution: each armed lane fires one ball that travels, applies
tiles, and resolves impact per ball, emitting the full event list. Implement the complete impact
function (including traits, so the rule lives in one place), coins for kills, and level-clear
detection for `mode: 'level'`.

## References

- GDD §3.5, §5 (all), §6.2–6.5, §8.2 · TR §6, §7

## Requirements

1. `/sim/resolve/impact.ts`: `resolveImpact(robot, ballValue) → ImpactOutcome` exactly per GDD §5.4,
   including Odd-only / Even-only blocking, Weakness doubling (positive multiples only), Bounce-back
   `min(|hp − damage|, maxHp)`, and exact/kill/survive outcomes. Traits are implemented and tested here even
   though they appear in play only in M4.
2. `/sim/resolve/fire.ts`: for lanes 0→4 with a cannon:
   - Emit `LaneStarted`, `BallFired` (value = `cannonBaseValue`, at col 0).
   - For cols 1→7: `BallMoved` into the cell; if an on-board robot is there → impact events, ball consumed, stop;
     else if a tile → `BallTransformed` with `chainDepth`.
   - No robot hit → `BallExited` after col 7.
   - Emit `LaneEnded`.
   - All events in a lane share `group: "fire:lane:<n>"`; `step` strictly increases across the whole resolution.
3. Impact events per TR §7: `BallBlocked` | `RobotDamaged` (+ `RobotBouncedBack` on overshoot) (+ `RobotDefeated`).
   Defeated robots are removed from state immediately. `CoinsChanged` with `income.kill` or `income.exactKill`
   from `economy.json` (exact kill pays `exactKill` instead of `kill`).
4. `/sim/resolve/resolveTurn.ts`: for `mode: 'level'`: FIRE only; clear `undo`; store `lastTurnEvents`;
   if no robots remain → phase `levelCleared` and emit `LevelCleared` (group `"end"`).
   For `mode: 'run'`: FIRE, then a clearly marked `// TODO(M2): advance, detonate, end check, spawn`.
5. Wire `endTurn` in `applyCommand` (coordinate with task 06 if merged first; otherwise add a minimal case).
6. No durations, no pixels in events.

## Tests

Unit tests for `resolveImpact` covering the full GDD §5.4 table:
- Normal: under (survive), exact (exact kill), over (kill), value 0, negative value.
- Bounce-back: 10 HP hit for 7 → 3; 10 → exact; 13 → 3; 25 → 10 (capped); 0 → unchanged; `RobotBouncedBack` only on overshoot.
- Odd-only: even value blocked; odd value damages; negative odd damages 0 (not blocked).
- Even-only: odd blocked; zero is even (not blocked, 0 damage).
- Weakness n=5: value 15 → 30 damage; value 0 → no doubling; value −10 → 0; exact kill evaluated on doubled damage.

Resolution tests (event-list assertions via an ordered-subsequence matcher in `/tests/helpers`):
- (1 + 4) × 3 − 2 = 13 → exact kill on 13 HP; `chainDepth` 1, 2, 3.
- Robot standing on a tile: that tile is not applied.
- Tiles beyond the first robot are not applied; second robot in lane is untouched.
- Unarmed lane fires nothing; lane with no robot emits `BallExited`.
- Lane order 0→4 and strictly increasing `step`.
- Coins: exact kill +2, overkill +1.
- Level clears when last robot dies.

## Acceptance Criteria

- [ ] `resolveImpact` matches GDD §5.4 for every case above
- [ ] Event list conforms to TR §7 and is deterministic (same input → deep-equal output)
- [ ] Tile application follows GDD §3.5 exactly
- [ ] Income values come from `economy.json`
- [ ] `npm test`, `typecheck`, `lint` pass

## Completion Notes

**Status:** Not Started
