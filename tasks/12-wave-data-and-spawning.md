# 12 — Wave Data & Spawning

**Milestone:** M2 · **Layer:** sim / data · **Depends on:** — · **Branch:** `task/12-wave-data-and-spawning`

## Task

Give waves a real data format, roll a wave's seeded variety at wave start, implement the SPAWN step
(including waiting robots), and implement `newRun`, so a run can start with its first robots on the board.
The rest of the turn loop (advance, detonation, end check, fast-forward) is task 13.

## References

- GDD §0 (v0.4), §3.1, §3.3, §4 (step 1), §10.1, §10.3, §10.5 · TR §4, §5, §6, §8, §9

## Context

`waves.json` is `{ "waves": [] }`, `robots.json` is `[]`, and both schemas accept anything. `SpawnEntry`
exists but has no HP. `newRun` returns `wrong_phase`. The fire step, impact rules, RNG and planning commands
are done (tasks 04, 06, 07).

## Requirements

1. **`robots.json` schema + data.** Templates `{ id, trait, isBoss }` (trait uses the existing `Trait` shape).
   Ship exactly one: `{ "id": "basic", "trait": { "type": "none" }, "isBoss": false }`. No visual key yet (M5).
2. **`waves.json` schema** exactly as in TR §9 (authored wave: `id`, `spawns[]` with `turn`, `lane` (0–4 or `A`–`E`),
   `robot`, `hp: [min, max]`, optional `reward.tiles`). All TR §9 validation rules, with readable error paths.
   Cross-file checks (robot ids, tile ids) go wherever `parseGameData` already does cross-file validation.
3. **Draft ladder content** in `waves.json` (finalized in task 17 after Playtest 1):

   | Wave | Spawns | Reward |
   |---|---|---|
   | wave-1 | T1: A 1–3 · T4: B 1–3 · T7: C 1–3 | `add:1` `add:2` `add:3` |
   | wave-2 | T1: A 4–10 · T5: B 4–10 · T9: C 4–10 | `mul:2` `add:4` |
   | wave-3 | T1: A 4–10 and B 4–10 · T6: A 5–12 and C 5–12 | none (final wave) |

4. **`SpawnEntry`** gains `hp` (TR §4). `RunState` gains `exactKills: number` (0 at start; incremented in task 13).
   Level-mode states set it to 0. Bump `economy.json` `schemaVersion` to **2**.
5. **`/sim/waves/rollWave.ts`:** `rollWave(waveDef, rngState) → { spawns: SpawnEntry[]; rng: RngState }`.
   Draw order exactly per TR §6 "Rolling a wave": letters in order of first appearance, each `nextInt` over the
   lanes still free (not fixed in this wave, not already taken by an earlier letter, in ascending lane order);
   then each entry's HP in file order. Output stable-sorted by `turn`. Uses only the `wave` stream.
6. **`/sim/waves/spawn.ts`:** the SPAWN step as a pure function over a `RunState` returning new state + events
   (group `"spawn"`), exactly per TR §6: waiting robots first (in `board.robots` order), then pending entries
   with `turn ≤ state.turn`, in order. Each enters col 7 of its lane if no robot is there (`RobotSpawned`), otherwise
   becomes a waiting robot with `col: null` (`RobotWaiting`, new robots only). A robot entering from waiting keeps its
   `robotId`. New robots take ids from `nextIds.robot`, `maxHp = hp`, trait/isBoss from the template.
7. **`newRun` command:** accepts `null` or any state. Builds the GDD §10.1 starting state from `economy.json`
   (1 cannon in `startCannonLane`, no tiles, `startCoins`, `baseHp`, `startBaseValue`), `mode: 'run'`,
   `phase: 'planning'`, `waveIndex: 0`, `turn: 1`, both RNG streams seeded from `seed` (derive the two streams so
   they differ), rolls wave 0, runs SPAWN, `lastTurnEvents: []`, `undo: []`. Returns the spawn events.
8. `resolveTurn` for `mode: 'run'` is untouched here (still FIRE + TODO) — task 13 owns it.

## Tests

- Schema: a valid wave parses; each TR §9 rule rejects with a readable path (bad lane token, `min > max`, `hp` 0 or
  100, no turn-1 spawn, unknown robot id, unknown tile id, reward on the last wave, too many letters for free lanes).
- Real `/data` loads (existing test) with the draft content.
- `rollWave`: same seed → deep-equal output; letters `A, B, C` always three different lanes over many seeds; a letter
  never lands on a lane fixed in the same wave; every HP within its range; sorted by turn; shop stream untouched.
- Spawn: robot enters col 7 when free; waits (`col: null`, `RobotWaiting`) when col 7 is occupied; a waiting robot
  enters before a newly scheduled robot in the same lane; two robots due in the same lane on the same turn → first
  enters, second waits; only entries with `turn ≤ state.turn` spawn; event group `"spawn"`, `step` strictly increasing.
- `newRun`: from `null` and from an existing level state; starting state matches `economy.json`; wave-1 turn-1 robot on
  the board at col 7; same seed → deep-equal state; different seeds → (generally) different lanes.
- Unit tests are enough here; run-mode scenario files arrive with task 13.

## Acceptance Criteria

- [ ] `robots.json` and `waves.json` have strict schemas; bad data fails `npm test` with a readable path
- [ ] Draft waves 1–3 shipped
- [ ] `rollWave` and SPAWN are pure, deterministic, and follow TR §6 draw/spawn order
- [ ] `newRun` produces the GDD §10.1 starting state with wave 1's first robot spawned
- [ ] `schemaVersion` is 2
- [ ] `npm test`, `typecheck`, `lint` pass

## Completion Notes

_To be filled in by `/finish-task`._
