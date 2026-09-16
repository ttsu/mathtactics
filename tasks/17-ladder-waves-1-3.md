# 17 — Ladder Waves 1–3 & Playtest 2 Checklist

**Milestone:** M2 · **Layer:** data / e2e · **Depends on:** 14, 15, 16, H1 · **Branch:** `task/17-ladder-waves-1-3`

## Task

Finalize wave 1–3 content using Playtest 1's findings, prove the run plays end to end on the real build, and write the
Playtest 2 checklist.

## References

- GDD §0 (v0.4), §4.4, §5.5, §10.1–10.3, §10.5, §12.2 (pacing target) · TR §9, §12, §16.1
- `playtests/01.md` (or the notes section of `playtests/01-checklist.md`) — **read first**

## Context

Task 12 shipped draft waves (below). They were written before Playtest 1, so this task revisits them. If Playtest 1
notes point to a **rule** change (not a number change), stop and raise it with the human — don't encode it in data.

| Wave | Draft spawns | Draft reward |
|---|---|---|
| wave-1 | T1: A 1–3 · T4: B 1–3 · T7: C 1–3 | `add:1` `add:2` `add:3` |
| wave-2 | T1: A 4–10 · T5: B 4–10 · T9: C 4–10 | `mul:2` `add:4` |
| wave-3 | T1: A 4–10 and B 4–10 · T6: A 5–12 and C 5–12 | none (final) |

Design intent per wave (GDD §10.2): wave 1 teaches moving the cannon and gives free exact kills; wave 2 teaches placing
tiles and addition; wave 3 threatens two lanes at once with one cannon (lane choice). Base HP stays 100: an M2 run is
effectively unlosable (base HP never regenerates, and if every robot in all three waves detonates at full HP the
total is 9 + 30 + 44 = 83) — intended; Playtest 2 asks whether a run holds together, not
whether it's hard.

## Requirements

1. **Tune `waves.json`** against Playtest 1 notes (pacing, where he stuck, reaction to exact kills). Record every change and
   its reason in Completion Notes. Wave-1 HP must stay small enough that 1-damage balls kill a robot well before it
   detonates (with base value 1, every wave-1 kill is exact automatically, GDD §5.5). If tuning pushes the worst-case
   full-run detonation total to 100 or more, raise it with the human (the unlosable-M2 decision).
2. **Balance checks as vitest** (`tests/ladder.test.ts`, shipped data, seeds 1–100):
   - every wave-2 robot can be exact-killed in at most 2 hits using ball values reachable with wave-1 reward tiles and
     base value 1 (the draft's max single shot is 1+1+2+3 = 7, so HP 8–10 needs two hits — intended chip damage);
     every wave-3 robot likewise with wave-1 + wave-2 rewards.
   - a simple "sensible player" bot (move the cannon to the lane of the front-most robot; fire; no tiles) finishes wave 1
     with zero detonations for every seed — proves wave 1's spacing allows moving the cannon in time.
   - an End-Turn-only bot always finishes the run (`won`) with base HP > 0 — proves the unlosable claim holds for the data.
   - record run length stats (turns per wave, min/median/max) in Completion Notes.
3. **e2e full run** (`e2e/run.spec.ts`): menu → New Run (real button) → loop: when planning, move the cannon to the front
   robot's lane via `dispatch`, `endTurn`, `skipAnimation`; on wave-cleared overlay tap ▶ → win screen → ▶ → menu with no
   Continue. Plus a reload in the middle of wave 2 → Continue → run completes.
4. **Pacing check:** measure real (non-skipped) playback time for a wave-3 turn on the preview; note it against the GDD
   §12.2 target. Adjust `presentation.json` only if clearly off; note changes.
5. **`playtests/02-checklist.md`** in the task-11 format. Question: *does a run hold together — do advancing robots create good
   pressure (moving the cannon, choosing a lane, going for exact kills) without frustration, and does he want to go again
   after winning?* Setup (Home Screen app, fresh New Run), the wave table with what each teaches, and what to watch for:
   - Does he notice the **danger glow**, and act on it (move the cannon to that lane)?
   - Reaction to **detonations** and the ♥ count-down — upset, amused, indifferent? Does he read the number?
   - Does he notice **waiting (ghost) robots**?
   - **Wave-cleared screen:** does he look at the reward tiles? Does he use them in the next wave, and how soon?
   - Wave 3 **lane choice:** does he pick a lane on purpose, or thrash the cannon?
   - Does he still chase **exact kills** when robots are moving, or just shoot?
   - **Continue:** close the app mid-run and reopen — does he find ▶ Continue?
   - Does he **tap ⌂ Home** by accident?
   - After the win: does he want another run? Does the exact-kill row mean anything to him?
   - Session length, waves reached, and blank notes sections (per wave, quotes, bugs, ideas for M3).
6. Update `TASKS.md`: H2 ready.

## Acceptance Criteria

- [ ] `waves.json` final for M2, changes justified by Playtest 1 notes
- [ ] Ladder balance tests pass for seeds 1–100
- [ ] e2e plays a full run through the real menus and screens, including a reload + Continue
- [ ] Pacing measured and noted
- [ ] `playtests/02-checklist.md` exists
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

**Status:** Complete
**Completed:** 2026-09-15

**Acceptance criteria:**
- [x] `waves.json` final for M2, changes justified by Playtest 1 notes — Met (kept draft; see waves.json changes below)
- [x] Ladder balance tests pass for seeds 1–100 — Met (`tests/ladder.test.ts`: unlosable total, exact-kill reachability, sensible-player wave-1 zero detonations, End-Turn-only wins with baseHp > 0)
- [x] e2e plays a full run through the real menus and screens, including a reload + Continue — Met (`e2e/run.spec.ts`)
- [x] Pacing measured and noted — Met (see below; no `presentation.json` change)
- [x] `playtests/02-checklist.md` exists — Met (includes End-Turn/"shooting 1s" watch item from Playtest 1)
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass — Met; also `npm run sim -- scenarios` (31/31)

**Verification:** npm test ✔ (775) · typecheck ✔ · lint ✔ · build ✔ · sim scenarios ✔ (31/31) · e2e ✔ (via `e2e-locked.sh`)

**waves.json changes (or no change) + reasons:**
- **No change** to any spawn HP ranges, turn spacing, lanes, or rewards vs the task-12 draft.
- **Reason:** Playtest 1 notes (`playtests/01-checklist.md`) are from the puzzle levels, not the ladder. They report enjoyment, easy controls, and that he discovered "shooting 1s" eventually clears enemies without movement — looking forward to movement and enemy variety. That is a features/pacing observation already addressed by M2 (advance + detonation), not a specific HP/spacing number request. Controller ruling: if notes don't justify specific number changes, keeping the draft with written rationale is acceptable. Raising wave 2–3 HP for more visible chip damage was optional within the unlosable budget; without playtest evidence of "too soft," inventing harder numbers would be an unauthorized design call.
- Wave-1 HP stays [1, 3]: base-value-1 balls exact-kill every robot before detonation (sensible-player bot: 0 detonations, seeds 1–100).
- Worst-case full-run detonation total (sum of every spawn's `hp` max) = **83** (< 100). End-Turn-only bot always `won` with baseHp > 0 (min remaining across seeds 1–100: **36**).

**Run-length stats (seeds 1–100):**

*Sensible-player bot* (move cannon to front-most robot each turn; fire; no tiles):

| | min | median | max |
|---|---|---|---|
| Wave 1 turns | 3 | 6 | 9 |
| Wave 2 turns | 13 | 15 | 15 |
| Wave 3 turns | 12 | 12 | 12 |
| Full-run End Turns | 29 | 33 | 36 |

*End-Turn-only bot* (no cannon moves, no tiles) — also recorded for the unlosable claim:

| | min | median | max |
|---|---|---|---|
| Wave 1 turns | 10 | 13 | 13 |
| Wave 2 turns | 12 | 15 | 15 |
| Wave 3 turns | 12 | 12 | 12 |
| Full-run End Turns | 34 | 40 | 40 |

Primary Completion Notes figure is the **sensible-player** table (matches the e2e driver and requirement 2's wave-1 bot). `e2e/run.spec.ts` uses `MAX_TURNS = 80` over the measured sensible-player max of 36.

**Pacing (requirement 4):**
- Measured on a local production build (Playwright WebKit, `VITE_TEST_HANDLE=1` build + preview): real (non-skipped) End Turn → `isIdle()` for a wave-3-shaped turn (one armed lane with a 3-tile chain on an HP-8 robot; second lane undamaged so it advances — representative of wave-3 "two lanes, one cannon").
- **Elapsed: 3398 ms (~3.4 s).**
- GDD §12.2 target: ~2–3 s per active lane + ~1 s advance → ~8–10 s for a **3-lane** turn. Task 15 noted ~10–12 s for 3-lane with detonation+spawn. A wave-3 turn arms **one** cannon, so ~3.4 s sits in the ~2–3 s + advance band — not clearly off.
- **`presentation.json`: no change.**

**Deviations from spec:**
- Pacing was measured on a local production-style Playwright preview (same stack as CI e2e), not a deployed PR preview URL — equivalent build, throwaway test not committed.
- Run-length stats computed with a one-off `tsx` script (not left in the tree).

**Architectural decisions made:**
- Kept task-12 draft ladder numbers as the M2 final content pending Playtest 2 feedback.
- Ladder balance tests load real shipped data via `parseGameData(loadRawGameData())` and drive `applyCommand` (no reimplementation of resolution).

**Design questions raised:**
- None for this task. Playtest 2's "shooting 1s" watch item will tell whether End-Turn-only clearing reduces engagement enough to justify harder wave 2–3 numbers later.

**Known issues / follow-up:**
- H2 (Playtest 2) is ready; human should run `playtests/02-checklist.md` on the preview/iPad.
- Tasks 14–16 still note "iPad check pending" from earlier sessions — unrelated to this data/e2e closeout.

**Files created:**
- `tests/ladder.test.ts`
- `e2e/run.spec.ts`
- `playtests/02-checklist.md`

**Files modified:**
- `TASKS.md` (H1 Complete; 17 Complete; H2 Not Started — ready)
- `tasks/17-ladder-waves-1-3.md` (these Completion Notes)
- `playtests/01-checklist.md` (H1 notes — prior commit `9888e79`)

**Notes for next agent:**
- `waves.json` is intentionally still the task-12 draft; do not retune from Playtest 1 alone. Wait for Playtest 2 notes (especially the "shooting 1s" watch item) before changing HP/spacing. Worst-case detonation budget headroom is 100 − 83 = 17 if harder numbers are later justified.
