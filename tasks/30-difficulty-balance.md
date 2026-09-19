# 30 — Per-Mode Leftover Bands

**Milestone:** M4.5 · **Layer:** data / tests · **Depends on:** 28 · **Branch:** `task/30-difficulty-balance`

## Task

Prove Easy, Normal, and Hard each match GDD §10.7 leftover intent on the trait-aware sensible
player. Tune only `data/difficulty.json` (and only with a recorded reason). Do **not** retune
`waves.json` to make a mode work — Normal is the designed ladder and stays owned by M4.

## References

- GDD v0.8 §0, §6.6, §10.7, §18.3 · Task 28 overlay formula
- Task 25 / 27 Completion Notes — leftover median 99 on Normal is known; **do not** grind
  Normal HP to chase 50–70 in this task
- `tests/ladder.test.ts`, `tests/helpers/sensiblePlayer.ts`
- `playtests/04-checklist.md` (H4 still plays Normal)

## Context

Difficulty uses §6.6 levers: count, simultaneous lanes, traits — not ever-larger numbers.
Easy is the v0.7.3 "stretch a little too hard" relief. Hard is the Playtest 3 "make it
harder" request. The bot still clears Normal near 100 HP; Hard's extra pack pressure and
no-`basic` mix are for a kid's working memory, not for forcing the bot's leftover into
50–70.

If a leak on Easy/Hard is a bot that ignored a trait, fix the bot (or the test), not the
mul. Same policy as task 22.

## Requirements

1. **Drive the bot per difficulty.** `newRun` with `{ seed, difficulty }` for each mode.
   Seeds 1–100. Record min / median / max leftover, End-Turn-only outcome, and whether every
   seed reaches wave 10.

2. **Locked assertions** (honest CI — do not name a band you do not check):

   | Mode | Sensible leftover | Sensible wins / reaches wave 10 | End-Turn-only |
   |---|---|---|---|
   | Easy | min ≥ 80 | 100/100 wins, 100/100 reach wave 10 | loses (baseHp ≤ 0) |
   | Normal | min ≥ 40 (today's assertion) | 100/100 wins | loses |
   | Hard | min ≥ 40 | 100/100 wins, 100/100 reach wave 10 | loses |

   Easy min ≥ 80 is the "quiet stretch" promise. If draft 75% / countDelta −1 overshoots or
   undershoots, retune `mul` / `countDelta` / parity floor in `difficulty.json` and say why.
   Do not drop Easy `minCount` below 2. Do not auto-enable hints. Do not raise Boss HP. Do
   not add a fourth procedural pack.

   Hard may sit at leftover ~99 like Normal. That is allowed. CI for Hard is **wins + reach
   wave 10 + min ≥ 40 + End-Turn-only loses**, plus the structural checks from task 28 (no
   `basic` on 8–9, counts ≥ Normal). If Hard *loses* a sensible seed, lower `countDelta` or
   stop dropping a template — do not raise the 99 cap, do not add armor.

   Normal assertions must not get stricter than task 27 shipped.

3. **Invariants across modes** (same seeds):
   - wave 1–7 spawned **templates** match on Easy/Normal/Hard
   - Boss HP is 1000 on all three
   - Easy non-Boss HP ≤ Normal ≤ Hard (Hard equals Normal on HP)
   - Easy procedural counts ≤ Normal ≤ Hard (where pools allow)
   - shop offers for a given seed are identical across difficulties (shop stream untouched)

4. **Playtest 5 checklist** — `playtests/05-checklist.md`. Question: does Easy feel like
   relief on 8–9, and does Hard feel like more to think about without becoming mean? Setup:
   fresh New Game, picker, play Easy one session and Hard another (or the reverse if he asks
   for harder first). Watch: does he pick a star on his own? Does he notice Normal is the
   middle one? Does Easy still lose if he never places tiles (you can demo that, not him)?
   After H4 notes exist, read them before writing this checklist so you don't duplicate
   Playtest 4 questions.

5. Record leftover tables (min/median/max, seeds 1–100) for all three modes in Completion
   Notes, plus any `difficulty.json` edits and why.

## Out of Scope

Picker UI (29). Changing `waves.json`, shop tables, Boss occupancy, teaching traits on 4/6/7.
Armor. Per-mode income.

## Acceptance Criteria

- [ ] Easy sensible leftover min ≥ 80; 100/100 wins; End-Turn-only loses
- [ ] Normal leftover assertion unchanged from task 27
- [ ] Hard sensible 100/100 wins and reaches wave 10; End-Turn-only loses; no `basic` on 8–9
- [ ] Cross-mode invariants (templates, Boss 1000, HP/count monotonic, shop identity)
- [ ] `playtests/05-checklist.md` written
- [ ] `npm test`, `typecheck`, `lint` pass

## Completion Notes

**Status:** Complete
**Completed:** 2026-09-19
**PR:** #54 · Preview: https://mathtactics.timtsu.com/pr/pr-54/
**Branch:** `cursor/plan-difficulty-modes-ca27` (not `task/30-difficulty-balance`)

**Acceptance criteria:**
- [x] Easy sensible leftover min ≥ 80; 100/100 wins; End-Turn-only loses — Met (min 96)
- [x] Normal leftover assertion unchanged from task 27 — Met (min ≥ 40; measured min 96 / median 99)
- [x] Hard sensible 100/100 wins and reaches wave 10; End-Turn-only loses; no `basic` on 8–9 — Met (min 86)
- [x] Cross-mode invariants (templates, Boss 1000, HP/count monotonic, shop identity) — Met
- [x] `playtests/05-checklist.md` written — Met (H4 notes `playtests/04.md` do not exist yet; checklist does not duplicate Playtest 4 questions)
- [x] `npm test`, `typecheck`, `lint` pass — Met

**Verification:** npm test ✔ (816) · typecheck ✔ · lint ✔

**Leftover tables (sensible player, seeds 1–100, leftover = final `baseHp`):**

| Mode | min | median | max | wins | reach wave 10 | End-Turn-only |
|---|---|---|---|---|---|---|
| Easy | 96 | 99 | 100 | 100/100 | 100/100 | loses |
| Normal | 96 | 99 | 100 | 100/100 | 100/100 | loses |
| Hard | 86 | 99 | 100 | 100/100 | 100/100 | loses |

**Deviations from spec:**
- **Branch name** is `cursor/plan-difficulty-modes-ca27`, not `task/30-difficulty-balance`.
- **No `difficulty.json` retune.** Draft 75% / parity 65% floor 8 / `countDelta −1` already meets Easy min ≥ 80. Hard `countDelta +1` + drop `basic` still 100/100 wins (leftover min 86 vs Normal 96). Formula unchanged.

**Architectural decisions made:**
- `playSensibleRun(seed, data, difficulty = 'normal')` and `playEndTurnOnlyRun` take an optional difficulty. Default keeps the task-27 Normal path.

**Design questions raised:**
- None.

**Known issues / follow-up:**
- Normal leftover median is still 99, not 50–70 (tasks 25/27). This task did not grind `waves.json`.
- H5 plays Easy and Hard with the kid; checklist is `playtests/05-checklist.md`.

**Files created:** `playtests/05-checklist.md`

**Files modified:** `tests/ladder.test.ts`, `tests/helpers/sensiblePlayer.ts`, `TASKS.md`

**Notes for next agent:**
- If Hard later loses a sensible seed, lower `countDelta` or stop dropping a template — do not raise the 99 cap, do not add armor, do not retune `waves.json` here.
- Easy minCount must stay ≥ 2.

