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

- [x] `resolveImpact` matches GDD §5.4 for every case above
- [x] Event list conforms to TR §7 and is deterministic (same input → deep-equal output)
- [x] Tile application follows GDD §3.5 exactly
- [x] Income values come from `economy.json`
- [x] `npm test`, `typecheck`, `lint` pass

## Completion Notes

**Status:** Complete

**Acceptance criteria:**

- [x] `resolveImpact` matches GDD §5.4 for every case above — Met: `sim/resolve/impact.ts` implements Parity → Weakness → apply damage → Bounce-back in that order; `tests/sim/resolve/impact.test.ts` covers every row of the table (normal under/exact/over/0/negative; Bounce-back 7/10/13/25/0 against a 10 HP robot plus the "never kills" invariant; Odd-only/Even-only including the "negative odd is not blocked" and "zero is even" edge cases; Weakness ×2 including the "exact kill evaluated on doubled damage" case).
- [x] Event list conforms to TR §7 and is deterministic — Met: `sim/resolve/fire.ts` builds each event as a full literal matching one `GameEvent` union member (no partial-object indirection that could drift from the TR §7 shape); `resolveImpact`/`resolveFire`/`resolveTurn` are pure functions over plain data, so identical inputs always produce a deep-equal event list (asserted implicitly by every `expectEventSequence`/`toEqual` in the new tests, which would be flaky otherwise).
- [x] Tile application follows GDD §3.5 exactly — Met: `fire.ts` checks `robotAt` before `tileAt` for every cell, so a robot's own tile never applies and nothing past the first robot is ever reached (loop `break`s on impact); covered by the "robot standing on a tile" and "tiles beyond the first robot" tests in `tests/sim/resolve/resolveTurn.test.ts`.
- [x] Income values come from `economy.json` — Met: `fire.ts` reads `data.economy.income.kill`/`.exactKill` (never a literal), covered by the coins test asserting `+2`/`+1` and a running `coins` total.
- [x] `npm test`, `typecheck`, `lint` pass — Met (see Verification).

**Verification:**

- `npm test` — 21 files, 204 tests passed (172 pre-existing + 32 new: 20 in `tests/sim/resolve/impact.test.ts`, 9 in `tests/sim/resolve/resolveTurn.test.ts`, 2 in `tests/sim/commands/endTurn.test.ts`, plus a net +1 in `tests/game/testHandle.test.ts` — the old "throws" case removed, two new dispatch-behavior cases added); one pre-existing test in `tests/sim/commands/planningCommands.test.ts` updated, not added (see Deviations).
- `npm run typecheck` — `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.sim.json --noEmit`, both clean.
- `npm run lint` — `eslint .`, 0 errors/warnings.
- `npx prettier --check` on all new/changed files — clean after one `--write` pass (formatting only, no logic changes).

**Deviations from spec / minor calls made (none conflict with GDD/TR, all within task ruling latitude):**

- **`ImpactOutcome` shape**: the brief specifies `resolveImpact(robot, ballValue) → ImpactOutcome` but doesn't fix its fields. Chose a discriminated union: `{ kind: 'blocked'; reason }` | `{ kind: 'damaged'; damage; doubled; hpBefore; hpAfter; result: 'exact'|'kill'|'survive'; bounceBack: { overshoot } | null }`. `bounceBack` is non-null exactly when `RobotBouncedBack` should be emitted (`damage > hpBefore`), so `fire.ts` never re-derives that condition — the rule lives in exactly one place per CLAUDE.md rule 1/6.
- **`BallExited.at`**: TR §7 doesn't say which cell a `BallExited` event carries. Used the last cell visited (col 7, the final tile cell) rather than a synthetic "col 8" — consistent with "the ball travels from column 1 to column 7" (GDD §5.3) and lets presentation exit the sprite from the last real cell.
- **Ordered-subsequence matcher location**: put the pure core (`matchEventSequence`/`partialMatches`) and the vitest-only wrapper (`expectEventSequence`) in one file, `tests/helpers/eventSequence.ts`, rather than two — the pure functions have zero vitest import and are trivially cut out when task 08 moves them into `/sim/scenario`, so a second file seemed like premature indirection.
- **`planningCommands.test.ts` update**: its "rejects endTurn, buyOffer, leaveShop, newRun even during planning" test predates `resolveTurn` and asserted `endTurn` always returns `wrong_phase` — now false for the `planning` phase, since `endTurn` is implemented. Removed `endTurn` from that list and renamed the test; the `state === null` case (which still returns `wrong_phase` for every command including `endTurn`) is untouched and still asserted separately.
- **`RunState.levelId!` non-null assertion** in `resolveTurn.ts`: `levelId` is typed optional (`string | undefined`) on `RunState` even though every `mode: 'level'` state has one (`buildLevelState` always sets it). Used the same `!` style already established in `sim/commands/planning.ts` rather than widening the `LevelCleared` event's `levelId` to `string | undefined`.

**Design questions raised:** None — every open call above was either explicit task-07 ruling or has no plausible alternative under GDD/TR.

**Known issues / follow-up:**

- `mode: 'run'` resolution is an explicit `// TODO(M2): advance, detonate, end check, spawn` stub in `resolveTurn.ts`, per the brief — FIRE runs for `'run'` mode too (coins/board updates apply) but nothing else happens yet; there is no automated test exercising `mode: 'run'` through `resolveTurn` since M2 hasn't defined what "done" looks like for it yet.
- `fire.ts` throws (rather than returning a `CommandError`) if a board cell references a piece id not in `state.pieces`, or a piece references a tile id not in `data.tiles` — this mirrors task 06's existing stance in `sim/commands/level.ts` that cross-referential integrity between `RunState`/`GameData` isn't a recoverable runtime error, only a data-authoring bug that should fail loudly in tests.

**Files created:** `sim/resolve/impact.ts`, `sim/resolve/fire.ts`, `sim/resolve/resolveTurn.ts`, `tests/sim/resolve/impact.test.ts`, `tests/sim/resolve/resolveTurn.test.ts`, `tests/sim/commands/endTurn.test.ts`, `tests/helpers/eventSequence.ts`

**Files modified:** `sim/resolve/index.ts` (real barrel, was task-01 placeholder), `sim/commands/applyCommand.ts` (`endTurn` now checks phase and calls `resolveTurn`), `sim/commands/ids.ts` (added `allocateBallId`, same pattern as `allocatePieceId`/`allocateRobotId`), `game/state/testHandle.ts` (`endTurn()` dispatches through the store per the ruling), `tests/game/testHandle.test.ts` (updated/added `endTurn` cases, `buildHandle` now takes an optional `applyCommand`), `tests/sim/commands/planningCommands.test.ts` (removed the now-stale `endTurn` case from the "rejects ... during planning" test), `TASKS.md` (status for task 07)

**Notes for next agent:**

- Task 08's scenario runner should move `matchEventSequence`/`partialMatches` (`tests/helpers/eventSequence.ts`) into `/sim/scenario` — they're already pure and vitest-free; only `expectEventSequence` (the `expect(...)` wrapper) stays test-only.
- `resolveFire`/`resolveTurn` are lane-independent and stateless beyond the `RunState`/`GameData` they're given, so M2's `mode: 'run'` work can call `resolveFire` unchanged and layer ADVANCE/DETONATE/END CHECK/SPAWN after it in `resolveTurn.ts` where the `// TODO(M2)` comment is.
- `allocateBallId` follows the exact `allocatePieceId`/`allocateRobotId` convention (`sim/commands/ids.ts`) — reuse it for any future ball-shaped id need (e.g. multi-ball in v1.1).
