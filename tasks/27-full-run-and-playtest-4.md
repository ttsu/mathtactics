# 27 — 10-Wave Balance, e2e & Playtest 4 Checklist

**Milestone:** M4 · **Layer:** data / e2e · **Depends on:** 23, 24, 25, 26 · **Branch:** `task/27-full-run-and-playtest-4`

## Task

Prove a 10-wave run with traits, shops 7–9, procedural 8–9, and the Boss is winnable by a
sensible player and losable by a careless one; play it end to end through the real UI; write
the Playtest 4 checklist.

## References

- GDD v0.7 §0, §6.6, §8.2, §10.1–10.2, §12.2 · TR §9, §12, §16.1
- `playtests/03-checklist.md` Notes — **read first**
- Task 21 Completion Notes — sensible-player policy, shop buy order, recorded stats
- `tests/ladder.test.ts`, `tests/helpers/sensiblePlayer.ts`, `e2e/run.spec.ts`

## Context

Tasks 22–26 stacked: traits on 4/6/7, telegraph, settings, waves 8–10, Boss. Playtest 3 said
too easy. If after 22–26 the sensible player still finishes seeds 1–100 with a min base HP
**above 70**, that is evidence the stretch is still soft — you may raise wave 8–9 HP or
`count` **inside §6.6** (≤ 99, ≤ 4 lanes) with a recorded reason. Do **not** retune waves 1–3
(Playtest 2 notes empty). Do **not** add armor. Do **not** drop the 40 HP floor.

Settings/hints are not part of the sensible-player bot (hints off is the default a kid gets).

## Requirements

1. **Read Playtest 3 notes** and the Completion Notes of 22–26. If they already retuned 8–9,
   do not reverse that without a new reason.

2. **Balance tests** (`tests/ladder.test.ts`, shipped data, seeds 1–100), same two bots as
   task 21 (real `applyCommand`, never a reimplementation):

   - sensible player **wins** every seed, never drops below **40** base HP;
   - End-Turn-only **loses** every seed;
   - every shop visit (after 1–9) offers the sensible player at least one affordable item;
   - second cannon still affordable by the shop after wave 3;
   - Boss is exact-killable in ≤ 3 hits with the tiles the sensible player owns on entering
     wave 10 (search bound the same way as task 21's ≤ 2-hit check);
   - record in Completion Notes: turns per wave (min/median/max), full-run End Turns, coins
     earned/spent per shop, purchases, final base HP, and how often wave 8/9 leaked.

3. **e2e** (`e2e/run.spec.ts`): menu → New Game through the real buttons → loop { planning:
   sensible-player via `dispatch` / `endTurn` / `skipAnimation`; wave-cleared: tap ▶; shop:
   buy a real affordable card then ▶ *Next wave* } through wave 10 → win screen → ▶ Home →
   menu with no Keep Going. Include a reload **inside a shop after wave 8** → Keep Going →
   same offers → finish. Keep the turn cap above the measured max.

   Plus a short e2e: menu → Settings → Hints on → Home → New Game → after placing (or
   dispatching) one tile in an armed lane, `getHints()` (task 24) is non-empty.

4. **`playtests/04-checklist.md`** in the task-11/17/21 format. Question: **does a complete
   run hold together — traits readable, stretch hard enough, Boss a finale, and does he want
   to go again?** Setup: Home Screen, fresh **New Game**, sound on. Watch for:
   - Does he read Weakness n / Bounce-back coil / Odd vs Even without being told?
   - Wrong-parity clonk: confusion or "oh, even"?
   - Bounce-back overshoot: does he reach for `−N`?
   - Wave 8–9: frustration or focus? Too long?
   - Boss: does three-digit HP land as special?
   - Settings / hints: does he find them? Does turning hints on change how he plays?
   - After win/lose: another run?
   - Session length, waves reached, per-wave notes, quotes, bugs, ideas for M5.

5. Update `TASKS.md`: H4 ready.

## Out of Scope

Armor. M5 juice, sound playback, art pass. Changing the 40 HP floor. Kid-facing title.

## Acceptance Criteria

- [ ] Sensible player wins seeds 1–100 above 40 HP on the 10-wave run; End-Turn-only loses
- [ ] e2e plays a full 10-wave run through menus, shop, and a mid-shop reload
- [ ] Settings/hints e2e covers the task-24 hook
- [ ] `playtests/04-checklist.md` exists
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e`, `npm run sim -- scenarios` pass
