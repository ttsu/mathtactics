# 28 — Difficulty Data, Overlay & RunState

**Milestone:** M4.5 · **Layer:** sim / data · **Depends on:** — · **Branch:** `task/28-difficulty-data`

## Task

Make Easy / Normal / Hard a simulation fact: a `difficulty.json` overlay, a `RunState.difficulty`
field, and `newRun` that applies the overlay when rolling waves. No UI in this task. **Normal
must be byte-identical to today's `waves.json` rolls.**

## References

- GDD v0.8 §0, §6.6, §10.7, §13, §17.2, §18.3 · TR §4 (`RunState`), §5 (`newRun`), §6
  (`rollWave`), §8 (RNG streams), §9 (data files)
- `sim/commands/newRun.ts`, `sim/commands/nextWave.ts`, `sim/waves/rollWave.ts`
- `sim/core/types.ts` (`RunState.mode` is already `'run' | 'level'` — do **not** reuse it)
- `sim/data/schemas.ts`, `sim/data/load.ts`, `game/state/gameData.ts`
- `data/economy.json` `schemaVersion` (currently 3)
- `tests/ladder.test.ts`, `tests/sim/commands/newRun.test.ts`, `tests/helpers/loadDataFiles.ts`

## Context

Playtest 3 asked to make it harder. v0.7.3 made the stretch a little too hard for a 7-year-old.
Three difficulties share one concept ladder. `waves.json` stays the Normal source of truth —
do not triplicate it. Difficulty changes HP and procedural pack size (and Hard drops `basic`
from 8–9 pools). That is simulation, so it belongs here, not in Phaser or React.

`RunState.mode` already means puzzle vs run. The new field is `difficulty`.

Omitting `difficulty` on `newRun` defaults to `'normal'` so existing scenarios and tests keep
working after they grow the new field on `RunState` (always written, never left undefined).

This task ships the overlay **and** the draft Easy/Hard numbers from GDD §10.7. Task 30 is
allowed to retune those numbers with a recorded reason; it is not allowed to change the
formula.

## Requirements

1. **`data/difficulty.json`** — new file, validated by Zod, loaded through `parseGameData`
   (add the `difficulty` key next to `waves`). Shape (normative):

   ```json
   {
     "default": "normal",
     "modes": {
       "easy": {
         "label": "Easy",
         "stars": 1,
         "hp": {
           "nonBoss": { "mul": 75, "min": 1, "max": 99 },
           "parity": { "mul": 65, "min": 8, "max": 99 },
           "boss": { "mul": 100, "min": 1, "max": 1000 }
         },
         "countDelta": -1,
         "minCount": 2,
         "maxCount": 5,
         "dropTemplates": []
       },
       "normal": {
         "label": "Normal",
         "stars": 2,
         "hp": {
           "nonBoss": { "mul": 100, "min": 1, "max": 99 },
           "parity": { "mul": 100, "min": 1, "max": 99 },
           "boss": { "mul": 100, "min": 1, "max": 1000 }
         },
         "countDelta": 0,
         "minCount": 1,
         "maxCount": 5,
         "dropTemplates": []
       },
       "hard": {
         "label": "Hard",
         "stars": 3,
         "hp": {
           "nonBoss": { "mul": 100, "min": 1, "max": 99 },
           "parity": { "mul": 100, "min": 1, "max": 99 },
           "boss": { "mul": 100, "min": 1, "max": 1000 }
         },
         "countDelta": 1,
         "minCount": 1,
         "maxCount": 5,
         "dropTemplates": ["basic"]
       }
     }
   }
   ```

   Schema rules: exactly the keys `easy`, `normal`, `hard`; `default` is one of them and is
   `normal`; `stars` is 1/2/3 uniquely; `mul` is a positive integer percent; `min ≤ max`;
   non-Boss `max` ≤ 99; boss `max` ≤ 1000; `countDelta` is an integer; `minCount` ≥ 1;
   `maxCount` ≤ 5; `minCount` ≤ `maxCount`; `dropTemplates` unique strings that exist in
   `robots.json` and must not include an `isBoss` template. Labels are the GDD words
   (`Easy` / `Normal` / `Hard`) so task 29 can read them from data rather than hardcoding.

2. **Overlay formula** — pure function in `/sim` (e.g. `sim/waves/applyDifficulty.ts`):

   ```ts
   applyDifficulty(wave: WaveDef, difficulty: DifficultyId, data: GameData): WaveDef
   ```

   For each authored spawn or procedural default/`hpByRobot` range `[lo, hi]`:
   - pick the `hp` band: Boss template → `boss`; `odd-only` / `even-only` → `parity`; else
     `nonBoss`
   - `scaled(n) = clamp(round(n * mul / 100), min, max)` with `Math.round` (half away from 0
     is fine; document which in Completion Notes if you have to pick)
   - `lo' = scaled(lo)`, `hi' = scaled(hi)`; if `lo' > hi'` then `hi' = lo'`

   For each procedural group:
   - `pool' = pool` minus `dropTemplates` (file order of remaining ids preserved)
   - drop any `hpByRobot` keys that are no longer in `pool'`
   - `count' = clamp(count + countDelta, minCount, maxCount)`
   - then `count' = min(count', pool'.length)` so without-replacement still holds
   - if `pool'` is empty, throw — Hard dropping `basic` must not empty a shipped pool

   Authored `spawns` never drop robots (teaching ladder). Only HP is scaled there.

   **Normal identity:** `applyDifficulty(wave, 'normal', data)` deep-equals `wave` for every
   shipped wave. Assert this. Same seed + `'normal'` → same `pendingSpawns` as today's
   `newRun` (compare against a fixture recorded from current `waves.json`, or against
   `applyDifficulty` skipped). The `wave` stream must consume the same draws in the same
   order — do not roll extra RNG for the overlay.

   Apply the overlay **before** `rollWave`, inside `newRun` / `nextWave` (and anywhere else
   that picks `data.waves.waves[i]` for a run). Puzzle `loadLevel` never calls it.

3. **`RunState.difficulty`** — `'easy' | 'normal' | 'hard'`, required on every run-mode
   state. Level-mode states may omit it or store `'normal'`; pick one and record it.
   `newRun` command:

   ```ts
   { type: 'newRun'; seed: string; difficulty?: 'easy' | 'normal' | 'hard' }
   ```

   Omitted → `'normal'`. Always written onto the resulting state. Scenario shorthand
   `{ newRun: <seed> }` stays Normal; add optional `{ newRun: { seed, difficulty } }` or a
   top-level scenario `difficulty:` — pick one, test it, record it. Existing scenario files
   must not need edits.

4. **`schemaVersion` 4** in `economy.json`. Pre-mode saves discard silently (GDD §10.4).
   Update fixtures that pin version 3 for a *valid current* save; keep a test that version
   3 is discarded.

5. **Tests** (event list / state, not pixels):
   - schema rejects a missing `normal` key, `mul: 0`, Hard `dropTemplates: ["boss"]`,
     duplicate mode keys
   - real `/data` loads
   - Normal identity (requirement 2)
   - Easy vs Normal, same seed: every non-Boss HP is ≤ Normal's; at least one procedural
     group's `count` is smaller; Boss HP still 1000; spawned robot *templates* on waves 1–7
     match (same teaching traits)
   - Hard vs Normal, same seed: procedural `count` is larger where the pool allows; no
     `basic` among wave 8–9 spawned templates; waves 1–7 templates **and** HP match Normal
   - same seed + same difficulty → identical `pendingSpawns` (determinism)
   - drawing from `shop` does not change Easy/Hard rolls
   - `{ type: 'newRun', seed }` without `difficulty` writes `'normal'`
   - a scenario that omits difficulty still matches its expected events
   - `tests/ladder.test.ts` default path is Normal (today's leftover assertions keep meaning)

6. **TR** — add `difficulty.json` to §9; document the overlay formula and draw-order
   ("overlay, then existing `rollWave`"); add `difficulty` to `RunState` and `newRun` in
   §4/§5. `gameData.ts` / `loadRawGameData` import the new file.

## Out of Scope

Picker UI, Settings row, leftover-band retune (29, 30). Changing `waves.json`. Armor. Per-mode
shop. Mid-run switch. Auto-enabling hints on Easy.

## Acceptance Criteria

- [ ] `data/difficulty.json` loads; Normal overlay is identity on every shipped wave
- [ ] Easy lowers non-Boss HP and procedural counts; Hard raises counts and drops `basic` on 8–9
- [ ] Boss HP 1000 on all three; waves 1–7 teaching templates unchanged
- [ ] `newRun` without `difficulty` is Normal; `RunState.difficulty` always set on a run
- [ ] `schemaVersion` 4; old saves discard
- [ ] Existing scenarios and Normal ladder tests still pass
- [ ] `npm test`, `typecheck`, `lint` pass

## Completion Notes

**Status:** Complete
**Completed:** 2026-09-19
**PR:** #54 · Preview: https://mathtactics.timtsu.com/pr/pr-54/
**Branch:** `cursor/plan-difficulty-modes-ca27` (not `task/28-difficulty-data`; 28–30 shipped together)

**Acceptance criteria:**
- [x] `data/difficulty.json` loads; Normal overlay is identity on every shipped wave — Met
- [x] Easy lowers non-Boss HP and procedural counts; Hard raises counts and drops `basic` on 8–9 — Met
- [x] Boss HP 1000 on all three; waves 1–7 teaching templates unchanged — Met
- [x] `newRun` without `difficulty` is Normal; `RunState.difficulty` always set on a run — Met
- [x] `schemaVersion` 4; old saves discard — Met (`store.test.ts` discards schemaVersion 3 vs economy 4)
- [x] Existing scenarios and Normal ladder tests still pass — Met
- [x] `npm test`, `typecheck`, `lint` pass — Met

**Verification:** npm test ✔ (816) · typecheck ✔ · lint ✔ · build ✔

**Deviations from spec:**
- **Branch name** is `cursor/plan-difficulty-modes-ca27`, not `task/28-difficulty-data`. Tasks 28–30 landed on the plan PR.
- **`Math.round` half-toward-+∞.** HP values are positive, so that is also half away from 0.

**Architectural decisions made:**
- Overlay is `applyDifficulty` then existing `rollWave` (`sim/waves/applyDifficulty.ts`). Overlay consumes no RNG.
- Level-mode states store `difficulty: 'normal'` (puzzles ignore it).
- Scenario shorthand `{ newRun: <seed> }` stays Normal; `{ newRun: { seed, difficulty } }` is the Easy/Hard form. Existing scenario files were not edited.
- `waveForRun(data, waveIndex, difficulty)` is the single lookup used by `newRun` / `nextWave` / debug jump.

**Design questions raised:**
- None.

**Known issues / follow-up:**
- None for this task. Task 30 owns leftover-band retune; it did not change the formula.

**Files created:** `data/difficulty.json`, `sim/waves/applyDifficulty.ts`, `tests/helpers/difficulty.ts`, `tests/sim/waves/applyDifficulty.test.ts`

**Files modified:** `data/economy.json`, `sim/{commands,core,data,scenario,waves}`, `game/state/gameData.ts`, `game/state/debug/actions.ts`, `TECHNICAL_REFERENCE.md`, fixtures under `tests/`

**Notes for next agent:**
- `RunState.mode` is still `'run' | 'level'`. Difficulty is `RunState.difficulty`. Do not reuse `mode`.
- Normal overlay must stay identity on shipped `waves.json`. Do not triplicate waves.

