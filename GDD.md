# Math vs. Robots — Game Design Document

**Title:** Math vs. Robots
**Version:** 0.9.5
**Platform:** Web, iPad landscape primary (iPad 10th gen, 10.9"), installable to Home Screen
**Stack:** TypeScript · React (UI) · Phaser 4 (board) — see §16 and `TECHNICAL_REFERENCE.md`
**Audience:** Children, approximately 2nd grade math level (ages 7–8)
**Status:** M4 and M4.5 built. Playtests 4–5 pending. v0.9 records M5 sound (rest of M5 unspecced).
v0.9.1 is a launch-screen label/glyph pass after a human review of the home page.
v0.9.2 drops the formula-strip banner once MATH VS ROBOTS is the launch decoration.
v0.9.3 renames the game to Math vs. Robots; the hosting URL stays `mathtactics.timtsu.com`.
v0.9.4 makes Normal slightly harder and Hard moderately harder.
v0.9.5 retunes the puzzle book: 1-star simple, 2-star moderate, 3-star Recipe is bounce-back exact.
This document is the single source of truth for *design*.
`TECHNICAL_REFERENCE.md` is the source of truth for *architecture*.

---

## 0. Changes in v0.9.5

Human request after Pack 1 shipped: the puzzles are too easy. One star should be simple,
two stars moderately challenging, three stars genuinely difficult.

- **Star bands.** 1-star is one idea and small numbers (Warm Up stays the tutorial). 2-star
  uses more robots, more HP, more waves or delayed spawns, and tile rearranging. 3-star
  must be an exact-amount exam.
- **Recipe is bounce-back.** Every robot on the one 3-star scenario is Bounce-back, so
  overkill does not clear it. Five waves, more robots, higher HP. A known exact-kill
  solution still exists.

## 0. Changes in v0.9.4

Human request: Normal should be slightly harder; Hard should be moderately harder.

- **Normal HP ticks up on waves 7–9.** The designed ladder in `waves.json` moves about
  10–12% on the stretch rungs. Waves 1–6 stay the teaching mid-run (raising 4–6 HP
  leaked a sensible seed). Wave 10 Boss stays 1000 / 2×2; the escort stays the light
  trap. Odd-only / Even-only stay in the **16–32** chip band.
- **Hard scales stretch non-Boss HP to 120%.** `hpApplies: procedural` leaves waves 1–7
  and the wave 10 escort at Normal HP. Parity stays **100%** so one leaked Odd-only /
  Even-only is still a chip. `countDelta +1` and dropping `basic` on 8–9 stay.
- **Easy overlay is unchanged** (75% / 65% / `countDelta −1`). It stays the quiet stretch
  relative to the new Normal.

## 0. Changes in v0.9.3

Human request: the game is *Math vs. Robots*. Hosting, repo, and package names stay `mathtactics`.

- **Title is Math vs. Robots.** Replaces the v1 working title Math Tactics on the document,
  Home Screen, and docs. The decorative launch letters stay MATH VS ROBOTS.

## 0. Changes in v0.9.2

Human request after MATH VS ROBOTS landed on the launch screen: drop the formula-strip banner
(ball → +N → ×N → −N). The title is the decoration; a second row of tiles was redundant.

- **No formula strip on the launch screen.** MATH VS ROBOTS is the only decoration above the
  buttons.

## 0. Changes in v0.9.1

Human request after looking at the launch screen: the resume label was truncated, the New Game
and Puzzles glyphs did not say what they did, and the decorative tiles looked tappable.

- **Resume label is *Continue*.** One word, fits the button. Replaces *Keep Going*, which
  overflowed as "Keep Go". Still a spoken word, still repeats the ▶ icon.
- **New Game is ▶ when it is the orange button** (nothing to resume — it is just play). The
  counterclockwise circular arrow is only the smaller New Game beside Continue, where it means
  start over. Not a robot-and-play composite. Continue stays the plain ▶.
- **Puzzles glyph is a jigsaw piece**, matching the 🧩 already named in §10.4. The ×-chip looked
  like a tile, not a mode.
- **Launch decoration is a formula strip, not a row of 3D chips.** Ball → +N → ×N → −N inside
  one muted capsule, no button shadow, `pointer-events: none`. It previews the game; it is not
  a control.
- **Settings cancel is ← *Back*** at the top left, the same control as the difficulty picker.
  Not a big ▶ *Home*.

## 0. Changes in v0.9

M5 sound, specified before Playtest 4 so the first juice slice can ship on the current
placeholders. Visual escalation, art, gallery, and title stay unspecced. Task 31.

- **Generated Web Audio only** (grill S1 A). Oscillators and bandpassed noise. No sample
  library, no `.wav` / `.ogg` in the repo. Phaser's sound manager stays unused; one shared
  `AudioContext` already unlocked on first `pointerdown` (TR §15).
- **Tactile, not chiptune.** Cues should feel like ASMR — rubber, wood, felt: short, close,
  soft attack. Every kid-facing control makes a sound (buttons, picking up and placing tiles
  and cannons, tray scroll). Debug is silent.
- **Tile pops are operator-coloured** (grill S2 B) on a `chainDepth` curve, never on ball
  value. `+` leans up, `−` leans down, `×` is brighter; depth still rises through a subtract.
- **Planning and playback both speak.** Cannon thump, spawn drop, drop / snap-back, shop
  buy / nope (grill S3 C). Wave-cleared is a short sting, quieter than win (grill S4 B).
  Lose is distinct from win and not sad (grill S5 B) — no shaming trombone.
- **No music in v1.** Planning is quiet so the first pop is the event.
- **Settings Sound row ships with the audio.** Icon + the word *Sound*, default on. Turning
  it on plays a preview so the toggle is audible the first time. `settings.sound` already
  exists in storage.
- **Replay plays sound.** Skip cuts remaining voices. Mute is on/off, not a slider.

## 0. Changes in v0.8

Three difficulties so one ladder can be both the Playtest 3 "make it harder" request and the
v0.7.3 "stretch is a little too hard" request. Specs in tasks 28–30. Not built yet.

Playtest 3: **fun but too easy**. v0.7.3: waves 7–10 with a 7-year-old, **a little too hard**.
The leftover-HP bot still sits near 100 on Normal (tasks 25/27) — HP alone cannot both chip a
sensible player and keep a sloppy run alive. Modes use the levers §6.6 already named.

- **Easy / Normal / Hard.** Grade-1 labels, 1 / 2 / 3 stars. Cover the text and the stars still
  work (§11.1). **Normal is today's ladder** — `waves.json` as shipped. Default for a first
  pick.
- **Same concept ladder, same shop, same starting kit, same Boss.** Waves 1–7 still teach in
  the same order. Shop tables, prices, income, 0 coins, 1 cannon, base 100, Boss **1000 HP
  2×2** do not change with difficulty. Hints stay a separate Settings toggle (off by default).
- **The stretch is what changes.** Easy: one fewer robot per procedural pack, lower non-Boss
  HP. Hard: one more robot per pack, `basic` dropped from waves 8–9 so every stretch robot has
  a trait. Authored teaching spawns are never removed. Normal robots still cap at 99.
- **New Game always opens a picker.** Three big buttons; last pick is highlighted. Continue
  does not ask — the saved run's difficulty is locked. Changing the Settings default never
  retcons a run in progress.
- **Difficulty is simulation.** It changes HP and spawn counts, so it lives in `/sim` and
  `/data/difficulty.json`, not in Phaser or React. `RunState.mode` is already `'run' | 'level'`;
  the new field is `RunState.difficulty`.
- **Build after Playtest 4** unless Easy is needed for the next session. H4 should measure
  one ladder (Normal). Modes are M4.5, before the M5 juice pass.

## 0. Changes in v0.7.3

Human request after playing waves 7–10 with a 7-year-old: the stretch is a little too hard,
and leaking one Odd-only / Even-only robot should be a chip, not a loss.

- **Waves 7–9 HP comes down a notch.** Wave 7 basics sit around 30–44 (was 36–50). Wave 8
  group HP is ~34–56 (was 42–75). Wave 9 group HP is ~42–64 (was 55–95). Waves 1–5 are
  unchanged. Wave 6's Bounce-back teaching robot drops to 40–50 (was 54–64).
- **Parity robots use a lower HP band.** Authored and procedural Odd-only / Even-only stay
  in **16–32 HP**. One leaked parity robot from typical leftover HP is survivable; two or
  more leaks can still end a run. Procedural groups keep a default `hp` for basics /
  weakness / bounce-back and override parity via `hpByRobot`.
- **Wave 10 escort stays a trap, not a tax.** T1 Bounce-back is 16–28; T7 Odd-only and
  Even-only are 16–24. The Boss remains 1000 HP.

## 0. Changes in v0.7.2

Human request after the M4 Boss shipped: the finale should *feel* like a finale.

- **Boss occupies a 2×2.** `lane`/`col` are the top-front cell; it locks both lanes and both
  columns for tiles, collision, advance, and hits. Balls in either occupied lane hit the same
  robot. Spawn front is column 6 so the back sits on 7. Authored on lane 1 (occupies 1–2),
  matching the starting cannon in lane 2.
- **Boss HP is 1000** (four digits). The 2×2 body is what keeps that numeral readable. Leaking
  it is still a loss. Exact-kill-in-3-hits is dropped — this is a multi-turn fight.
- **Escorts carry traits.** T1 Bounce-back, T7 Odd-only + Even-only. Same light HP as before;
  they stay a kid-facing trap, not the leftover-HP lever.
- **Shop after 9 guarantees `×5` as well as `−N`.** A 1000 HP 2×2 detonates in six turns;
  without a `×5` the weakest trays (only `×2`) leak the Boss.

## 0. Changes in v0.7.1

Special-bot telegraph after the M4 planning-phase chrome shipped. The antenna-count plus
colour-wash on Odd-only / Even-only was too close to a basic robot, and the trait itself was
not readable. Bounce-back's bar spring did not show the "you overshot, it came back" story.

- **Parity robots carry a shield on the left** (toward the incoming ball), on a normal grey
  block. **One dot** = odd numbers are blocked; **two dots** (stacked) = even numbers are
  blocked. Odd-only (hurt by odd, blocks even) has two dots; Even-only (hurt by even, blocks
  odd) has one. A blocked ball shakes the **shield only** — the robot body stays still. A
  hitting ball uses the normal knockback. HP stays the largest numeral. No ODD/EVEN letters.
- **Bounce-back overshoot:** at impact the remainder pops off the ball and lands to the right
  of the robot; then it is sucked into the robot while HP counts up and a flurry of tiny
  green pluses fade upward. Exact kill still removes it; a short hit still just counts down.
- **Weakness n** sits beside a small red lightning bolt on the robot, overlapping the bottom
  edge so HP does not cover it.

## 0. Changes in v0.7

v0.7 records the decisions made while writing the M4 task specs, after Playtest 3.

Playtest 3 (checklist notes): the run was **fun but too easy**; he asked for **armor** on
waves 9/10 — a second HP, shown separately, that must be destroyed first.

- **Hardness: one teaching trait plus a 4–7 HP bump.** Waves 4/6/7 still get a single teaching
  trait; remaining robots on those waves stay `basic`; wave 5 stays untraited (grill A). HP on waves
  4–7 is raised so sloppy play can leak (Playtest 3: too easy). Waves 1–3 are unchanged
  (Playtest 2 notes empty). A **sensible player** still ends the 7-wave stretch at **80–100**
  base HP (min ≥ 80 across seeds 1–100; at least some seeds finish below 100 — today's
  100/100/100 is the too-easy bug). Waves 8–10 do the real damage: a sensible player
  **wins the 10-wave run** with leftover **min near 40** (still ≥ 40) and **median 50–70**.
  Those chips come from **waves 8–9** for a sensible player (who kills the escort). Wave 10
  keeps a **light-but-present escort**: one `basic` at T1 plus two more at T7. Leaking the
  Boss is a loss. The T7 pair is a kid-facing trap, not a bot HP tax. A sloppy run **can
  lose on 8–9 and never see the Boss** (grill A). The sensible player still always reaches
  wave 10.
- **Armor is deferred to v1.1+.** It is a new rule (a second number on the robot), not a trait.
  It fights §11.2 (HP is the largest element) and is closer to Barrier (§19) than to Weakness /
  Bounce-back / parity. Not in M4, M5, or v1.
- **Waves 4, 6, 7 gain their first teaching trait.** Wave 4: one Weakness (`n = 5`, grill A). Wave 6:
  one Bounce-back (grill A: the −N shop after 5 is the exam). Wave 7: one Odd-only (grill A: base
  value 1 is odd, so the first contact can hurt without a tile). Wave 5 stays untraited (grill A) —
  it teaches subtraction. Remaining robots on those waves stay `basic`.
- **The run is 10 waves.** Shops after waves 7, 8 and 9. Wave 10 has no shop. HUD wave dots
  already follow `waves.json` length. Shop after 7 guarantees `×2` or `×5` (grill A). Shop after
  8 guarantees nothing (grill A). Shop after 9 guarantees `×5` and `−N` — `×5` is the 1000 HP
  toolkit (a tray of only `×2` cannot chip 1000 before the 2×2 detonates); `−N` is last trim.
- **Waves 8–9 are procedural tables** in `waves.json` (not authored spawn lists). Rolled at
  wave start on the `wave` stream. Mixed traits, HP inside §6.6. Both waves may spawn `basic`.
  Wave 8 is **3+3** (grill A): T1 three, T8 three — mix traits without four-lane panic.
  Wave 9 has more robots overall **and** more at once: packs of 4 plus an extra pack (grill C).
  Even-only can roll on wave 8 from T1 (grill B) — first-ball clonk is the lesson.
  Procedural packs draw **without replacement** (grill B): at most one of each template per group.
  Wave 8 T1 and T8 use **split pools** (grill A): T1 is n=5 + both parities + bounce + basic;
  T8 introduces weakness-2 and weakness-10. Wave 9 uses **one shared full mix** on every pack
  (grill A).
- **Wave 10 is authored:** one Boss (**1000 HP**, **2×2**, **no trait**) plus escort with
  traits at T1 (Bounce-back) and T7 (Odd-only + Even-only). Leaking the Boss is a loss.
  The four-digit HP is the puzzle — a multi-turn fight, not a ≤ 3-hit exact kill.
- **Trait telegraph is M4; loud juice stays M5.** Planning must show which trait is in play
  without words (§6.2–6.4). Bounce-back drain-to-zero-then-refill (v0.7.1) and blocked clonk
  already play; further celebration juice stays M5.
- **Settings and planning hints ship.** Gear on the main menu; hints **off by default** (grill A);
  he can turn them on. Hints show **ball value only** — no trait effects, blocked/doubled damage,
  or outcome (grill A). **No Sound row in M4** (grill A) — the toggle would do nothing audible
  until M5 Web Audio. `settings.sound` may stay in storage defaulting on.

## 0. Changes in v0.6.1

The in-play fire control is a green ▶ **Go**, not an orange "End Turn" label. Firing is the one
required action each turn; the old wording and colour were too easy to miss. After
`presentation.json` `hud.goNudgeIdleMs` with no tile, cannon, or tray change during planning, Go
gives a subtle wiggle. The simulation command remains `endTurn`.

## 0. Changes in v0.6

v0.6 records the decisions made while writing the M3 task specs. M3 replaces the M2 wave-reward
stand-in with the real economy, so most of these refine §8:

- **Wave rewards are gone.** The shop is the only way tiles enter a run (§10.5).
- **Between waves:** the wave-cleared screen stays as the celebration — star, wave dots, and the
  wallet with the wave-clear bonus popping in — and its ▶ opens the shop. The shop's
  ▶ *Next wave* starts the next wave. Two taps between waves (§8.3).
- **The shop is a full screen and one-way.** No board interaction while it is open; bought tiles
  wait in the tray for the next planning phase; leaving is final and unbought offers vanish.
- **Offers are rolled once**, when the shop opens, and stored with the run. Closing and reopening
  the app shows the same offers with the same slots already bought — no reroll by reload (§8.5).
- **Guarantees fill the leftmost cards** (§8.5). Card positions never move between visits: the
  guaranteed-useful card is where the player looks first.
- **The cannon card keeps its slot at 5 cannons**, dimmed and inert, instead of disappearing and
  reflowing the row (§8.3). Stable positions beat a tidy row at this age.
- **The upgrade card shows the resulting base value** as `1 → 2` (§8.3) — legible without words,
  and a small piece of arithmetic in itself.
- **One purchase per slot per visit.** A bought card dims with a tick; the upgrade cannot be
  bought twice in one shop (§8.6).
- **A tap he cannot afford** shakes the card and flashes the price. No dialog, no words (§8.6).
- **NEW is logged when the shop opens**, for tile offers only, so the sticker stays put for the
  whole visit (§8.7).
- **The browsable seen-tiles gallery is deferred to M5** with the art pass. M3 ships the log and
  the sticker (§8.7).
- **Waves 4–7 ship untraited in M3.** Trait *rules* already work, but §6.2–6.4 require a loud
  visual telegraph, and those visuals are M4 — an untelegraphed Bounce-back robot reads as a bug.
  M4 swaps the trait templates into these waves (§10.2).
- **An M3 run (7 waves) is losable** — the first one that is. Balance target: a sensible player
  wins without dropping below 40 base HP; a player who only taps End Turn loses.
- **Purchases are not animated across renderers.** Nothing flies from the React shop into the
  Phaser tray in M3; the purchase beat is local to the card. Full juice is M5 (§12.3).

## 0.1 Changes in v0.4

v0.4 records the decisions made while writing the M2 task specs (before Playtest 1):

- **Fast-forward:** if the board is empty but the wave still has scheduled robots, the next
  scheduled group spawns immediately (§4.4). The player never taps End Turn on an empty board.
- **Lane letters:** authored spawn entries name a fixed lane or a lane letter; each distinct
  letter is a different seeded-random lane for that wave (§10.3).
- **Run length comes from data:** the run ends in a win after the last wave in `waves.json`
  (10 in v1; 3 during M2).
- **Wave rewards (M2 stand-in for the shop):** clearing a wave grants authored tiles to the
  tray (§10.5). Removed when the shop arrives in M3.
- **Wave-cleared screen** between waves; **exact-kill count** shown on the win and lose screens.
- **Danger glow:** during planning, a lane whose robot is on column 1 glows red at the base (§12.2).
- **Detonation playback:** the robot's HP flies to the base HP in the HUD, which counts down (§12.2).
- **Main menu:** ▶ Continue · New Run · Puzzles (the M1 levels are kept). A **Home** button in
  the HUD returns to the menu without confirmation (§10.4).

## 0.2 Changes in v0.3

v0.3 is the result of a structured design review. Every former `[OPEN DECISION]` is
resolved or explicitly deferred. Major changes from v0.2:

- **Cannons live in a fixed cannon slot column** (col 0), one per lane; tiles occupy cols 1–7.
  Runs start with one cannon and nothing else.
- **Kills resolve per ball**, not at end of turn.
- **Overkill Heal is replaced by Bounce-back**: `hp = min(|hp − damage|, maxHp)`.
- **Parity Shield is reframed** as Odd-only / Even-only robots (show what hurts, not what blocks).
  The v0.7.1 telegraph reverses the *visual*: the shield now shows which numbers bounce off
  (one dot = odd blocked, two dots = even blocked). The rule is unchanged.
- **v1 tiles are `+N`, `−N`, `×N` only.** Count tiles, path tiles, and Barrier are cut from v1.
- **Robots have speed 1 and no attack stat.** Waves are spawn schedules.
- **Same concept ladder every run**; 10 waves; normal robots capped at 99 HP; Boss finale.
- **Planning hints** (running total per tile) exist, off by default.
- **Lanes resolve independently and play back one at a time.**
- **Renderer decided:** React for UI, Phaser 4 for the board.
- **Autosave/resume**, **GitHub Pages hosting** with per-PR previews.
- Deferred ideas collected in §19.

---

## 1. Concept Summary

A turn-based, lane-defense roguelike where the player defeats advancing robots by
building *equations out of board geometry*. Each lane's cannon fires a ball with a
numeric value. Tiles in the lane transform the ball as it passes — adding, subtracting,
multiplying. Damage dealt equals the ball's value at the moment of impact.

Each lane reads left to right like a written equation:

```
[cannon: 1]  +4   ×3   −2   → robot (HP 13)        1 + 4 = 5, × 3 = 15, − 2 = 13  ✔ exact kill
```

The core skill is arithmetic: reading a robot's HP, then arranging tiles so the ball
arrives carrying the right number.

### 1.1 Design Pillars

1. **The board is the equation.** Tile placement *is* the math. There is no separate
   "answer a question" UI. The player never types a number.
2. **Follow the number.** Every transformation is visible on the ball as it travels.
   A player who watches closely can always explain why the damage was what it was.
3. **Precision beats power.** Exact kills are rewarded. Some robots punish overkill.
   This is what makes subtraction and small tiles desirable rather than strictly worse.
4. **Failure is cheap.** A bad turn costs base HP, not a run. Runs are short enough
   that a loss is an invitation to retry, not a punishment.

### 1.2 Non-Goals (v1)

- No multiplayer, no accounts, no cloud sync.
- No timed pressure. The planning phase is untimed by design.
- No word problems, no text-based math prompts, no quizzes.
- No meta-progression between runs beyond a "seen tiles" collection log and
  which puzzle-book scenarios this device has cleared (§10.8).
- No division, splitting, path/redirect tiles, count tiles, or structures (see §19).
- No tuned iPhone layout (iPhone is scaled and playable, not tuned).

---

## 2. Math Scope

Tuned to 2nd grade as a *ballpark*, not a hard curriculum cap.

| Operation | v1 Scope | Notes |
|---|---|---|
| Addition | `+1` … `+10` tiles | Primary early operation |
| Subtraction | `−1` … `−10` tiles | Trimming to exact; key against Bounce-back |
| Multiplication | `×2` … `×10` tiles | Order of operations emerges from tile order |
| Division | Deferred past v1 | Arrives later as the Splitter (§19) |
| Parity | Odd-only / Even-only robots | "Does everyone have a partner?" |
| Multiples | Weakness robots (2, 5, 10) | Skip counting |

### 2.1 Number Rules

- **Negative ball values are legal.** The value is never clamped mid-flight. A ball at
  −4 deals 0 damage (§5.4). A player can go negative and climb back out.
- **Ball value has no cap.** Chaining `×10` tiles is a valid, celebrated strategy.
- **Zero is even. Negative numbers have ordinary parity** (−3 is odd).
- **Normal robot HP never exceeds 99** (two digits). Only the Boss uses four digits (§6.6).
- No fractions or non-integers exist in v1.

---

## 3. Board

### 3.1 Dimensions and Coordinates

- Grid is **5 lanes × 8 columns**. Lanes are indexed **0–4, top to bottom**.
- **Column 0 is the cannon slot column.** Each lane has exactly one cannon slot.
- **Columns 1–7 are tile cells.**
- The **base** sits to the left of the cannon slot column, spanning all lanes.
- Robots **spawn at column 7** (a 2×2 Boss spawns with its front at column 6 so the back sits
  on 7) and advance **right to left**.
- A robot at column 1 that advances **reaches the base and detonates** (§7.2).
  Robots never enter column 0.
- Balls travel **left to right** from the cannon slot.
- Below the grid is the **tray** (§9.3). HUD elements occupy the margins.

```
          col0    col1  col2  col3  col4  col5  col6  col7
 BASE  │ [cann] │  +4 │  ×3 │     │  −2 │     │ R13 │     │   lane 0
       │ [    ] │     │     │     │     │     │     │     │   lane 1
       │  ...                                                  ...
 ─────────────────────────────────────────────────────────────
  TRAY:  [+5] [×2] [−1] ...
```

### 3.2 Orientation and Device

- **iPad landscape** at 1180 × 820 pt (2× pixel density) is the design and test target.
  That yields roughly 100 pt cells. Minimum touch target anywhere: **60 pt**.
- Other aspect ratios (iPhone, other iPads) scale-to-fit with letterboxing. The grid never reflows.
- Portrait orientation shows a full-screen, text-free "rotate your device" illustration.

### 3.3 Occupancy

- A cannon slot contains nothing or a cannon.
- A tile cell contains nothing or one tile, and additionally may contain one robot.
- **Robots walk over tiles.** Nothing on the board blocks robots except other robots.
- **Nothing on the board can be attacked** by robots. Robots only damage the base.
- **One robot per cell, always.**

### 3.4 Locked Cells

A cell containing a robot is **locked** during planning: the player cannot place a tile
into it, or pick up a tile from under it. When the robot leaves, the cell unlocks.

### 3.5 Which Tiles Apply

A ball applies tiles cell by cell, left to right, starting at column 1. When the ball
enters a cell containing a robot, **the robot is hit first and the ball is consumed**
(§5.3). Therefore:

- The tile in the robot's own cell **does not apply** (the robot is "standing on it").
- Tiles to the right of the first robot do not apply to this ball.
- As a robot advances, the equation in its lane gets shorter. The same board produces
  a different number next turn. This is intended: it creates time pressure without a
  clock, and it prevents unchanging-board stalemates.

---

## 4. Turn Structure

A **wave** is played over multiple **turns**. Only Go (End Turn) is a required player action.

```
1. SPAWN         Robots scheduled for this turn (and any robots waiting off-board)
                 enter the far-right of their lane if every cell of their footprint is
                 free (column 7 for a 1×1; columns 6–7 and two lanes for a 2×2 Boss).
                 A robot whose spawn cells are occupied waits off-board (shown as a ghost).
2. PLANNING      Untimed. Player drags tiles between tray and cells, moves cannons
                 between empty cannon slots, uses Undo, may Replay the last turn.
3. FIRE          Player taps Go. Each armed lane resolves independently (§5).
                 Hits resolve immediately, per ball (§5.4).
4. ADVANCE       Surviving robots advance one cell left, front-most (lowest column)
                 first. A robot blocked by a robot ahead waits in place.
                 A robot advancing from column 1 detonates on the base (§7.2).
5. END CHECK     If base HP ≤ 0 → run lost.
                 Else if every scheduled robot in the wave has spawned and none remain
                 → wave cleared → Shop (or Win after the final wave).
                 Else → next turn (back to 1).
```

### 4.1 Rules Established by This Ordering

- A robot defeated during FIRE never advances and never damages the base.
- Robots always advance before they can be hit again, so a slow-killing board loses
  ground steadily.
- A robot always spawns *before* planning, so the player sees every robot before firing at it.
- If the base falls on the same turn the wave would clear, the run is **lost**.

### 4.4 Fast-Forward

If, at the start of step 1, **no robots are on the board or waiting** but the wave still has
scheduled robots, the turn counter jumps to the next scheduled spawn's turn and those robots
spawn now. Spacing in the schedule therefore only matters while robots are present; killing
quickly brings the next robot sooner, never an empty turn.

### 4.2 Placement Freedom and Brute Force

Placement is free and unlimited during planning. A player may fire, observe, and
rearrange. This is intentional:

- Robots advance every turn regardless, so trial-and-error costs board position.
- Iterating toward a correct answer *is* the learning process at this age.
- The exact-kill bonus rewards getting it right the first time.

### 4.3 Undo

- Undo is **multi-level within one planning phase** and reverts board/tray/cannon moves.
- Undo history is cleared when End Turn is tapped. Undo never reverts a shop purchase.

---

## 5. Balls and Damage

### 5.1 Firing

- Each lane whose cannon slot holds a cannon fires **exactly one ball** per turn.
- The ball's starting value is the **cannon base value**: 1 at run start, raised by
  upgrades (§8.4). All cannons share one base value.
- Lanes are fully independent in v1: balls never change lanes and never interact.

### 5.2 Ball Properties

| Property | Description |
|---|---|
| `value` | Integer (may be negative, uncapped). |
| `lane` | Lane index; constant in v1. |
| `col` | Current column. |
| `direction` | Always `right` in v1. Modeled from day one for v1.1 path tiles. |
| `chainDepth` | Number of tiles applied so far (drives presentation escalation). |

### 5.3 Travel

The ball moves from column 1 to column 7, one cell at a time. In each cell:

1. If the cell contains a robot → **impact** (§5.4). The ball is consumed. Stop.
2. Else if the cell contains a tile → apply the tile to `value`; `chainDepth += 1`.

If the ball passes column 7 without hitting a robot, it exits the board with no effect.
Off-board (waiting) robots cannot be hit.

### 5.4 Impact Resolution (per ball)

Resolved immediately when a ball enters a robot's cell. Trait order (relevant once
traits can stack, post-v1): **Parity → Weakness → apply damage → Bounce-back check.**

```
# 1. Parity (Odd-only / Even-only robots)
if robot.trait is ODD_ONLY  and value is even → BLOCKED: 0 damage, ball consumed, stop
if robot.trait is EVEN_ONLY and value is odd  → BLOCKED: 0 damage, ball consumed, stop

# 2. Base damage
damage = max(0, value)

# 3. Weakness
if robot.trait is WEAKNESS(n) and value > 0 and value % n == 0 → damage = damage × 2

# 4. Apply
if robot.trait is BOUNCE_BACK:
    newHp = min(|robot.hp − damage|, robot.maxHp)
else:
    newHp = robot.hp − damage

# 5. Outcome
newHp == 0 → EXACT KILL  (robot removed, 2 coins, celebration)
newHp <  0 → KILL        (robot removed, 1 coin)            # never happens for Bounce-back
newHp >  0 → SURVIVES    (robot.hp = newHp; damage carries to future turns)
```

Notes:
- A ball worth 0 or less deals 0 damage. Against Bounce-back, 0 damage leaves HP unchanged.
- In v1, each lane has one ball per turn, so a ball always hits the *first* robot in reach.
  The per-ball rule is specified generally so v1.1 multi-ball mechanics need no redesign:
  **if multiple balls reach robots, each resolves immediately; a removed robot's cell is
  empty for all later balls.**

### 5.5 Exact Kill

Reducing a robot to exactly 0 HP. Pays **2 coins instead of 1** and triggers the most
satisfying celebration in the game (§12). This is the primary teaching signal.

In wave 1, robots have 1–3 HP and the ball is worth 1, so every wave-1 kill is an exact
kill. The player experiences the celebration before learning what "exact" means.

### 5.6 Transformation Visibility

- The ball displays its current value, readable in motion.
- Crossing a tile triggers a distinct visual beat (flash / scale pop) and the number updates.
- On impact, damage dealt and the robot's resulting HP are both shown.

### 5.7 Planning Hints

- An optional hint shows, under each tile in an armed lane, the ball's running total
  after that tile — up to and including the last tile before the first robot:
  `1 → 5 → 25 → 22`.
- Hints never show trait effects, blocked/doubled damage, or the outcome (grill A).
- **Off by default.** Toggled in the Settings screen (reached from the main menu, not the HUD).

---

## 6. Robots

### 6.1 Robot Properties

| Property | Description |
|---|---|
| `hp` / `maxHp` | Displayed at all times; largest element on the robot |
| `trait` | None, or exactly one trait (§6.2–6.4) |
| `isBoss` | Boss flag (§6.6) |

Robots move at speed 1. There is no `speed` or `attack` property in v1.

### 6.2 Trait: Bounce-back

After any hit, the robot's HP becomes **how far off the shot was**, capped at full health:

```
newHp = min(|hp − damage|, maxHp)
```

| 10 HP robot hit for | Result |
|---|---|
| 7 | 3 (3 short) |
| 10 | exact kill |
| 13 | 3 (3 over) |
| 25 | 10 (way over → refills to full) |

- Only an exact hit kills. This makes subtraction genuinely valuable.
- Presentation: overshooting makes the robot visibly **bounce back**. At impact the remainder
  pops off the ball and lands to the right of the robot; then it is sucked in while HP counts
  up and a flurry of tiny green pluses fade upward. A short hit (no overshoot) just counts
  HP down. Legible from the remainder numeral and the pluses together.
- Because HP never exceeds `maxHp`, detonation damage never exceeds `maxHp`.
- Visual design must telegraph the trait loudly (e.g. springy/coiled silhouette).

### 6.3 Trait: Odd-only / Even-only

The robot can only be hurt by balls of one parity. A shield on the **left** of the robot
(the side the ball hits) shows **which numbers bounce off** — one dot = odd blocked, two
stacked dots = even blocked ("does everyone have a partner?").

- **Even-only** robots carry a teal shield with **one** dot: odd balls clonk, even balls hurt.
- **Odd-only** robots carry a purple shield with **two** dots: even balls clonk, odd balls hurt.
- The body stays the basic grey block with HP centred. The shield is a separate piece so a
  blocked ball can shake the shield without moving the robot. A hitting ball uses the normal
  knockback. No ODD/EVEN letters.
- A wrong-parity ball is **blocked**: 0 damage, ball consumed (a "clonk"). It does not
  pass through to robots behind.
- Robot HP is unconstrained by parity. An Odd-only robot with even HP needs two or more
  odd hits (odd + odd = even), possibly across turns.
- Useful facts the player discovers: any odd `+N`/`−N` flips parity; any even `×N`
  forces even; the base cannon value 1 is odd.

### 6.4 Trait: Weakness to Multiples

- The robot displays a number *n* ∈ {2, 5, 10} beside a small red lightning bolt on the
  body, overlapping the bottom edge (in front of HP so the numeral stays readable).
- A ball whose value is a positive multiple of *n* deals **×2 damage**.
- Exact kill is evaluated on the doubled damage.
- The softest trait: rewards skip-counting fluency, never blocks progress.

### 6.5 Trait Rules

- At most **one** trait per robot in v1.
- Canonical order for future stacking: Parity → Weakness → damage → Bounce-back.

### 6.6 HP Scaling and the Boss

- **Normal robots: 1–99 HP.** Difficulty comes from robot count, simultaneous lanes, and
  traits — not ever-larger numbers. Easy / Normal / Hard (§10.7) only move those three
  levers, still inside this cap.
- Placeholder curve (tuned in data): wave 1 → 1–3, wave 2 → 4–10, wave 5 → ~10–30,
  wave 9 basics → ~46–70. Odd-only / Even-only stay in **16–32 HP** so one leaked
  parity robot is a chip, not a run-ending detonation.
- **Boss** (wave 10 only): one robot, **1000 HP**, **no trait**, occupying a **2×2** (top-front
  authored on lane 1, so it covers lanes 1–2 and two columns). Balls in either occupied lane
  hit it. Arrives with a light escort of traited robots (T1 Bounce-back, T7 Odd-only and
  Even-only). Detonates for remaining HP like any robot. The four-digit HP is the puzzle.

---

## 7. The Base

- Starts at **100 HP**. Base HP does **not** regenerate in v1.
- Loss condition: base HP ≤ 0 at the end check (§4 step 5).

### 7.1 Why 100

Round and legible; tracking "how much is left" is itself arithmetic practice. With the
99 HP cap, a single leaked normal robot can never end a run from full health. Parity
robots stay in a 16–32 HP band so one missed Odd-only / Even-only is a chip, not a loss.

### 7.2 Detonation

A robot advancing from column 1 detonates: it deals damage to the base equal to its
**remaining HP** (never more than `maxHp`), then is removed. Detonations resolve one at a
time in lane order.

Chip damage is meaningful: a 60 HP robot worn down to 8 costs 8 base HP instead of 60.

---

## 8. Economy and Shop

### 8.1 Coins

Coins are small, countable integers (a typical wallet holds 0–30). Wallet and prices are
shown as numbers **and** coin stacks. Coins persist across waves (Balatro model). The run
starts with **0 coins**.

### 8.2 Income (placeholder values, in data)

| Source | Coins |
|---|---|
| Kill | 1 |
| Exact kill | 2 (instead of 1) |
| Wave cleared | 3 |

### 8.3 Shop Timing and Layout

The shop appears **after every wave except the last**. Never mid-wave. It is reached from the
wave-cleared screen (§10.5) and is a **full screen**: the board is not interactive while it is open.

```
wave clears → wave-cleared screen (star, wave dots, wallet) → ▶ → SHOP → ▶ Next wave
```

Layout, with **fixed positions** that never move between visits:

- **3 tile offers** — guaranteed offers (§8.5) always fill the leftmost cards
- **1 cannon offer** — a cannon glyph with 5 pips showing how many are owned. At 5 cannons the card
  stays in its slot, dimmed and inert, rather than vanishing and reflowing the row
- **1 upgrade offer** — all cannons' base value +1, shown as the resulting value: `1 → 2`
- The **wallet**, as a numeral and a coin stack
- The **tiles already owned**, read-only, so "do I need another `+2`?" is answerable here
- A big **▶ *Next wave*** button

Leaving is final: unbought offers vanish, coins carry over, and there is no way back in.
**No rerolls, no interest, no selling** in v1.

### 8.4 Pricing (placeholder values, in data)

| Item | Price |
|---|---|
| `+N` tile (green) | 4 |
| `−N` tile (blue) | 4 |
| `×2`–`×5` tile (orange) | 6 |
| `×6`–`×10` tile (orange, starred) | 9 |
| Cannon | 10, +5 per cannon already owned beyond the first |
| Upgrade (+1 base value) | 12, +6 per upgrade already bought |

Bigger numbers are not strictly better in this game, so prices are by category, not by N.

### 8.5 Offer Generation

- Tile offers are drawn from **per-wave weighted tables** in data (categories, N ranges, weights).
- The **concept ladder** (§10.2) adds guaranteed slots (e.g. "after wave 4, at least one `×N`").
  Guaranteed offers fill the **leftmost** cards.
- Early tables favor small N; the full range opens by around wave 5.
- **Duplicates are allowed**, within and across shop visits.
- Offers use a **dedicated seeded RNG stream**, separate from wave generation, so
  purchases never affect which robots come next.
- Offers are rolled **once, when the shop opens**, and stored with the run. Reopening the app
  inside a shop shows the same offers and the same already-bought slots.

### 8.6 Purchases

- Bought tiles go to the **tray**, and are placed during the next planning phase.
- A bought cannon is **auto-placed in the topmost empty cannon slot**. Cannons are never in
  the tray.
- An upgrade takes effect immediately for all cannons.
- **One purchase per slot per visit.** A bought card dims with a tick; the upgrade cannot be
  bought twice in the same shop.
- A tap on an unaffordable card **shakes the card and flashes its price** — no dialog, no words.
  A bought or unavailable card does nothing.
- Purchases cannot be undone (§4.3).

### 8.7 Seen-Tiles Log and NEW Badge

The game tracks which tile types have ever been **offered** on this device. A never-offered
type shows a "NEW" sticker in the shop. The seen-tiles log and the puzzle-book completion
list (§10.8) are the only data persisted across runs. Both are discovery logs, not power
progression.

- A type is logged when the shop **opens**, so a sticker stays put for the whole visit rather than
  vanishing under the player's finger. Only tile offers are logged.
- A **browsable collection screen** is deferred to the M5 art pass; M3 ships the log and the
  sticker only.

---

## 9. Tiles

### 9.1 v1 Tile Set (29 types)

| Kind | Range | Color | Effect |
|---|---|---|---|
| Add | `+1` … `+10` | green | `value = value + N` |
| Subtract | `−1` … `−10` | blue | `value = value − N` |
| Multiply | `×2` … `×10` | orange (`×6`+ starred) | `value = value × N` |

Tiles show a large operator and number. Color reinforces category; the symbol carries meaning.

### 9.2 Tile Properties

| Property | Description |
|---|---|
| `kind` | `add` / `sub` / `mul` |
| `n` | Operand |
| `priceCategory` | Drives shop price (§8.4) |

Each owned tile is **one physical piece**. Owning one `+5` means one `+5` on the board or in the tray.

### 9.3 Tray

- Owned tiles not on the board sit in the tray below the grid (rendered in Phaser).
- During planning, tiles move freely between tray and any **empty, unlocked** cell in
  columns 1–7 of any lane (armed or not), and between cells.
- Tile positions **persist** between turns and between waves.

### 9.4 Cannons

- Cannons occupy cannon slots (column 0). One per lane, max 5.
- During planning a cannon can be dragged to any **empty** cannon slot.
- Cannons cannot be attacked or destroyed.

---

## 10. Waves and Run Structure

### 10.1 Run

- A **run** is **10 waves**. Wave 10 is the Boss wave.
- Clearing wave 10 → Win celebration → main menu.
- Base HP ≤ 0 → cheerful loss screen → main menu. No shaming.
- Target wall-clock: 15–25 minutes.
- Starting state: **1 cannon (lane 2), no tiles, 0 coins, base 100 HP, cannon base value 1.**
  Difficulty is chosen on New Game (§10.7); it does not change this kit.

### 10.2 Concept Ladder (same every run)

Every run climbs the same ladder. Exact HP values, lanes, timing, and non-guaranteed
shop slots are seeded-random within each rung.

| Wave | Robots | Shop after this wave guarantees | Teaches |
|---|---|---|---|
| 1 | ~3 robots, HP 1–3, one lane at a time, lane varies | `+N` offers only (small N) | Moving the cannon; exact kills (free) |
| 2 | HP 4–10, one lane at a time | at least one `×2` | Placing tiles; addition |
| 3 | Two lanes threatened at once | — (the cannon offer is always present; income should make a 2nd cannon affordable around here) | Lane choice; shop tradeoffs |
| 4 | First **Weakness** robot | at least one `×N` | Multiples |
| 5 | All **basic**, larger HP (~10–30) | at least one `−N` | Subtraction as a tool |
| 6 | First **Bounce-back** robot (grill A), HP 40–50 | — | Trimming to exact |
| 7 | First **Odd-only** robot (HP 22–30); basics ~34–48 | at least one `×2` or `×5` (grill A) | Odd and even |
| 8 | Procedural **3+3** (grill A), basics ~38–60, parity ~20–30 | — (grill A) | Combining; Even-only at T1 |
| 9 | Procedural **4+4+3** (grill C), one full mix (grill A), basics ~46–70, parity ~22–32 | at least one `−N` (grill A) | Four lanes and an extra pack |
| 10 | **Boss** (1000 HP, 2×2, no trait) + traited escort | — (no shop; win) | The big number |

No tutorial mode and no text popups: wave design does the teaching. Easy / Normal / Hard
change how loud the stretch is, not which lesson each wave is for.

Waves 4–7 shipped **untraited** in M3. M4 swaps in the first teaching trait on waves 4, 6
and 7 (wave 5 stays untraited, grill A) and adds the visuals that telegraph them (§6.2–6.4). A robot
whose trait is invisible reads as a bug, not a puzzle.

### 10.3 Waves as Spawn Schedules

- A wave is a list of spawn entries: `(turn, lane, robot template)`, where the template
  specifies HP range and trait.
- Robots trickle in over turns. Early waves contain 2–3 robots.
- A wave is **cleared** when every scheduled robot has spawned and none remain (killed or detonated).
- Waves 1–7 are authored templates with seeded variation; waves 8–9 are generated from
  data tables; wave 10 is authored.
- **Lane letters.** An authored entry's lane is either a fixed lane (0–4) or a letter (`A`–`E`).
  At wave start each distinct letter is assigned a **different** seeded-random lane, avoiding
  lanes used by fixed entries. `A, B, C` = three different lanes; `A` again = the same lane.
  HP values and letter lanes are all rolled at wave start, so play never changes what comes.
- Robots scheduled for the same turn spawn in file order. Waiting robots enter before newly
  scheduled ones (they were scheduled earlier).
- The run ends in a win after the **last wave in `waves.json`**.

### 10.4 Save and Resume

- The run **autosaves after every command** (placement, move, End Turn, purchase).
- On End Turn, the resolved result is saved **immediately**, before playback finishes.
  Reopening mid-playback lands in the next planning phase: no lost progress, no reload exploit.
- Launch screen: big **▶ *Continue*** if a run exists, with smaller **↺ *New Game***; if no
  run, big **▶ *New Game***. Smaller **🧩 *Puzzles*** opens the puzzle book (§10.8). Each is
  an icon with its label beneath (§11.1). No confirmation dialogs. New Game opens the
  difficulty picker (§10.7), then replaces any saved run. Continue resumes the saved run's
  difficulty as-is. The launch screen has no formula-strip banner under the title.
- A small **Home** button in the HUD (hidden during playback) returns to the launch screen with
  no confirmation. A run is already saved. Home from a puzzle session returns to the puzzle
  book and drops the session.
- **Puzzle sessions are never saved** and never overwrite the saved run. Cleared-scenario
  ids are stored separately, like seen-tiles.
- A run that is won or lost is cleared from storage; Continue disappears.
- Saves carry a schema version. A mismatched save is silently discarded (no migrations in v1).
- The seen-tiles log is stored separately, is additive, and survives version bumps.

### 10.5 The Wave-Cleared Screen

Clearing a non-final wave shows a **wave-cleared** screen: a star, the wave dots with the cleared
wave filled, the wallet with the wave-clear bonus popping in, and a big ▶ labelled *Next* that
opens the shop (§8.3, §11.1).

**Removed in M3:** during M2 the shop did not exist, so each wave in `waves.json` listed a
**reward** of tile ids granted to the tray when it cleared, and this screen popped those tiles in.
M3 deleted rewards from the data and the schema — the shop is now the only way tiles enter a run —
and the reward chips became the wallet beat above.

### 10.6 Win and Lose Screens

- Both are cheerful, with one big ▶ labelled *Home* back to the launch screen (§11.1). No
  sentences on either screen — the celebration and the exact-kill row carry the meaning.
- Both show the run's **exact-kill count** as a row of icons (celebrating the core skill even
  on a loss). `RunState` tracks `exactKills`.

### 10.7 Three Difficulties

A run is Easy, Normal, or Hard. The player picks on **New Game**. Puzzles ignore this.

| | Easy | Normal | Hard |
|---|---|---|---|
| Label + icon | *Easy*, 1 star | *Normal*, 2 stars | *Hard*, 3 stars |
| Identity | Quiet stretch; a leak is a chip | Today's designed ladder | Loud stretch; every 8–9 robot has a trait |
| Waves 1–7 | Same spawns; HP scaled down | `waves.json` as shipped | Same spawns and HP as Normal |
| Waves 8–9 | One fewer robot per pack; HP scaled down | 3+3 and 4+4+3 as shipped | One more robot per pack; `basic` dropped; non-Boss HP scaled up |
| Wave 10 Boss | 1000 HP, 2×2 | 1000 HP, 2×2 | 1000 HP, 2×2 |
| Escort / parity | Scaled with Easy HP | As shipped (16–32 band) | As shipped |
| Shop, income, starting kit | Unchanged | Unchanged | Unchanged |
| Sensible player | Wins; leftover high (min ≥ 80) | Wins; leftover min ≥ 40 | Wins; always reaches wave 10 |
| End-Turn-only | Still loses | Still loses | Still loses |

**Picker (grill A).** New Game always opens a full-screen picker: three equally large buttons
in a row (stars + label), last pick pressed. A small ← *Back* at the top left returns to the
menu without starting. Tapping a difficulty starts the run and remembers the pick. There is
no extra confirm. Cover the labels and the star counts still distinguish the three. Settings
also shows the same three-way control so a parent can change the default without starting a
run; that default is what the picker highlights next time. It never mutates `RunState` of a
run already going.

Continue does not show the picker. A saved Easy run stays Easy.

**What difficulty may change:** robot HP (non-Boss, still 1–99) and procedural pack `count`
(and Hard's 8–9 pool, by dropping `basic`). Integer percent multipliers and a count delta live
in `data/difficulty.json`. `waves.json` stays the Normal source of truth — do not triplicate
the ladder.

**What difficulty may not change in v1:** the concept ladder, authored robot templates, shop
offers/prices/guarantees, starting kit, base 100, Boss occupancy or HP, hints, sound, or
puzzle levels. No mid-run switch. No "start at wave N" (still §19).

Draft Easy multipliers (tune in task 30, recorded reason required): non-Boss HP **75%** of
Normal; Odd-only / Even-only **65%** (floor 8) so one leak stays a chip; procedural
`countDelta` **−1**, `minCount` **2**. Hard (v0.9.4): stretch non-Boss HP **120%**
(`hpApplies: procedural`); parity **100%** so one leak stays a chip; `countDelta` **+1**,
`maxCount` **5** and never above the remaining pool; drop `basic` from procedural pools only.

### 10.8 Puzzle Book

Puzzles is a book of authored scenarios, not the 10-wave ladder.

- **🧩 Puzzles** opens a scrolling grid of authored scenarios, sorted easy → hard (1–3
  stars). ← *Back* at the top left returns to the launch screen. Tapping a tile starts that
  scenario. Catalog stubs with no waves yet stay hidden.
- Each tile shows **1–3 stars** (difficulty), a short name, and a **check** if this device
  has cleared it. Cover the name and the stars / check still work (§11.1).
- A scenario is a short authored run: 1–5 waves, full turn loop (fire, advance, detonate).
  HP and lanes are fixed — the same board every play. Tiles and extra cannons are granted on
  a schedule. There is no shop and no coins on the HUD.
- Wave-cleared **Next** grants the next wave's kit and starts it. Clearing the last wave
  writes the check and shows the win screen; its button returns to the book.
- Leaking to 0 HP shows the lose screen. Big **Play again** restarts that scenario from
  wave 1. ← *Back* returns to the book. No check mark.
- Pack 1 ships playable. Later packs stay in `puzzles.json` but stay off the grid until they
  have waves. The M1 FIRE-only boards in `levels.json` remain a test/debug harness.
- **Stars are difficulty.** 1 star is simple (one idea, small numbers; Warm Up is the
  tutorial). 2 stars are moderately challenging (more robots, more HP, more rounds, a trait
  or a rearrange). 3 stars are genuinely difficult. Pack 1's only 3-star, Recipe, uses
  Bounce-back on every robot so the player must hit the exact amount.

---

## 11. UX Requirements for the Target Age

1. **No reading required for core play.** Traits, tile functions, and state must be
   legible from shape and color — a player who cannot read a word must still be able to play
   a whole run. Text is supplementary, never load-bearing.

   **Short labels are allowed and encouraged on navigation** (v0.5). Icon-only buttons proved
   ambiguous in practice: nothing on the main menu said what ▶ or ↺ would do. So any button
   that *navigates* — menu entries, screen buttons — pairs its icon with a short label beneath.
   Rules for that label:
   - One or two words, grade-1 decodable, from the kid's spoken vocabulary
     (*Continue*, *New Game*, *Puzzles*, *Home*, *Back*, *Next*, *Go*, *Easy*, *Normal*, *Hard*,
     *Play again*). Puzzle-book names are 1–2 spoken words on the tiles.
     Never *Resume*, *Proceed*, *Select*. *Keep Going* overflowed the button; *Continue* is the
     one-word resume label (v0.9.1).
   - It **repeats** what the icon already says; it never adds information the icon lacks.
     Cover the text and the screen must still be usable.
   - In-play HUD Undo and Replay stay icon-only — they are used dozens of times a run and are
     learned by doing, not by reading.
   - The fire control is a green ▶ **Go**. Firing is the one required action each turn, so it
     pairs the play icon with a one-word label (same rule as navigation: cover the text and the
     button still reads). After `hud.goNudgeIdleMs` with no tile/cannon/tray change, it wiggles.
   - Still no sentences, no instructions, no explanations of rules, and no words carrying math
     meaning. Wave design does the teaching (§9).
2. **Numbers are the largest UI element.** Ball values and robot HP beat art for priority.
3. **Every state change is animated and slow enough to follow.** Never resolve a turn instantly.
4. **No fail-state shaming.** Losing returns cheerfully to the menu.
5. **Undo during planning.** A mis-drag never costs anything.
6. **Big touch targets.** ≥ 60 pt; drag-and-drop tolerates imprecise fingers.
7. **No Safari interference.** No pinch-zoom, pull-to-refresh, swipe-back, or text-selection
   on long-press during play.
8. **Settings** (from main menu): planning hints (off by default); difficulty default
   (Easy / Normal / Hard, default Normal); sound on/off (default on) once M5 audio ships.

---

## 12. Art Direction and Game Feel

### 12.1 Art

- **Prototype:** placeholder geometric shapes. Ship the prototype ugly.
- **Production (M5):** AI-generated 2D assets.
- Balls read as **red rubber balls** — the one locked visual.
- Palette keeps numbers high-contrast against every background. Anything that fights the
  numbers gets cut.
- Tile colors: `+` green, `−` blue, `×` orange.

### 12.2 Juice Model: Sequenced Resolution

Modeled on Balatro: satisfaction comes from **playing back an already-computed result as a
timed, escalating sequence**. The simulation produces an event list; presentation performs it.

**Playback order:**

1. Lanes play **one at a time, top to bottom**, skipping lanes with no cannon or no robot in reach.
2. The **active lane is highlighted**; other lanes dim slightly. The camera does not move.
3. Per lane: cannon *thump* → ball travels → *pop* per tile (rising pitch, growing scale
   pop, intensifying trail) → impact → outcome beat (kill / exact-kill / bounce-back / clonk / survive).
4. Robots **advance together** in one beat. A robot leaving column 1 lurches into the base
   during this beat.
5. **Detonations** play one at a time: flash and shake at the base; the robot's HP number flies
   to the HUD base HP, which **counts down** to its new value (100 → 92). Base HP displays
   never go below 0.
6. **Spawns** play last: new robots drop into column 7. A robot that must wait appears as a
   translucent **ghost** (HP visible) just right of column 7 in its lane, and slides in when
   it enters.

**Planning-phase cues (derived from state, not events):**

- **Danger glow:** a lane whose robot stands on column 1 (it will detonate this turn unless
  killed) pulses red at the base strip, and that robot wobbles slightly.
- **Go nudge:** if tiles, cannons, and the tray have not changed for `hud.goNudgeIdleMs` during
  planning, the Go button wiggles. Any placement, move, return, or cannon move restarts the wait.

**Requirements:**

1. **Escalation across a chain.** A five-tile chain feels like a crescendo.
2. **Impact is the payoff.** Screen shake scaled to damage, robot knockback, damage numbers
   flying off and settling.
3. **Exact kills get a unique, unmistakable celebration** — the most satisfying moment in the game.
4. **Bounce-back gets an equally loud negative beat** — the remainder pops off the ball,
   lands to the right of the robot, then is sucked in while HP counts up and tiny green
   pluses fade upward.
5. **Blocked (parity) hits** get a distinct "clonk": the shield shakes, the robot does not.
6. **HUD commits follow playback.** Coins and base HP update only when the matching event plays.
7. **Skip:** tapping during playback jumps to the end of the current lane; tapping again skips the next.
   Remaining scheduled sounds for that lane cut with the visuals.
8. **Replay:** a HUD button during planning replays the last turn's events. Simulation commits
   stay no-ops; **sound plays**.
9. **Pacing lives in data** (`/data/presentation.json`: ball speed, per-tile pause, lane gap).
   Target: ~2–3 s per active lane + ~1 s advance → ~8–10 s for a 3-lane turn.

### 12.3 Juice Is Presentation-Only

> **Anything that changes a number belongs to the simulation. Anything that only changes how
> it feels belongs to presentation.** Presentation never reports back to the simulation.

### 12.4 Sound

Sound is a teaching channel, same job as the gold star and the clonk shield. He should hear
*what happened* without looking up from the number.

- **One player** in `/game/state` (board and UI must not import each other). `playCue(name, params?)`
  no-ops when `settings.sound` is false or Web Audio is missing. Recipes live in
  `presentation.json` `audio` — no Hz, gain, or duration in code (GDD §13).
- **Sparse, bounded, distinct valence.** Pitch tracks **chain depth** (1–7), never ball value.
  Exact kill sparkles (a fixed figure, even on a 1-tile wave-1 kill). Bounce-back sucks
  backward. Clonk is dead wood. Those three do not share a family.
- **Tactile UI.** Enabled buttons, lifting a piece, placing it, snapping it back, and tray
  ticks all click. The click is satisfying and close, not an arcade bleep.
- **Skip** stops voices for the skipped segment. **Replay** plays the cues again.
- **Mute** is a Settings row. Turning sound on plays a preview. No volume slider, no music.

---

## 13. Data-Driven Design Requirement

All tunable content lives in JSON data files validated by schema on load. An agent should
never need to edit code to change a number.

Data-defined: tile definitions, robot templates and traits, wave spawn schedules and
procedural tables, HP ranges, difficulty overlays (Easy / Hard multipliers and pack deltas),
shop pricing and offer tables, ladder guarantees, economy values, starting state, presentation
pacing and audio recipes. File list in `TECHNICAL_REFERENCE.md`.

---

## 14. Technical Architecture (summary)

Full details in `TECHNICAL_REFERENCE.md`.

### 14.1 Determinism (Locked)

Turn resolution is **deterministic and headless-runnable**. Given a state and seed(s),
resolution produces identical output with no rendering. Ball paths are a function of the
board alone. No physics engine in the simulation.

### 14.2 Layers

- **`/sim`** — pure TypeScript. State, commands, turn resolution, shop generation, wave
  generation. Emits event lists. No renderer, DOM, or framework imports.
- **`/game/state`** — framework-free store bridging sim and renderers.
- **`/game/board`** — Phaser 4: grid, tray, tiles, cannons, robots, balls, hints, playback.
- **`/game/ui`** — React: HUD, shop, menus, settings, win/loss screens, seen-tiles log.

### 14.3 Event List

Resolution emits ordered events carrying step index, concurrency group, lane, grid
positions, and chain depth. Tests assert on this list; presentation plays it back.
Presentation never contains game rules; the simulation never contains durations.

### 14.4 Simultaneous Fire

In v1, lanes are independent, so lane resolution order cannot change outcomes. Events are
emitted in lane order 0→4. A tie-break rule for balls meeting in one cell is a **v1.1
requirement** that ships with path tiles.

---

## 15. Build, Validation, and Deployment

### 15.1 Agent-Facing Validation

1. `npm test` — vitest over `/sim` and data schemas. **The agent's default verification step.**
2. `npm run lint` / `npm run typecheck`.
3. `npm run sim -- <scenario>` — runs a scenario file and diffs against expected events/state.
4. `npm run build`.
5. `npm run test:e2e` — Playwright, **WebKit** with iPad landscape emulation.

### 15.2 Browser Test Handle

Test-handle builds (dev and PR previews; never production) expose `window.__GAME__` for
installing state, ending turns, reading events, and skipping animation. Playwright asserts
on structured state, not pixels. This handle is **essential** because the board is a Phaser canvas.

### 15.3 Deployment

- **Repo:** `github.com/ttsu/mathtactics` (public).
- **Hosting:** GitHub Pages at **`mathtactics.timtsu.com`** (`gh-pages` branch).
- **`main`** → deploys to the site root (production; what the Home Screen icon points to).
- **Pull requests** → preview at `mathtactics.timtsu.com/pr/pr-<N>/`, removed when the PR closes.
- **CI** (GitHub Actions) on every PR: typecheck, lint, test, build, e2e. Required to merge.
- Home Screen install is a **required** setup step for the playtester (protects localStorage
  from Safari's 7-day eviction and gives fullscreen).
- Storage keys and the web manifest scope are **path-scoped**, so opening a PR preview can
  never overwrite the production run or hijack the Home Screen icon.

### 15.4 Test Coverage Priorities

In order: per-ball impact resolution and exact-kill detection; traits (Bounce-back, parity,
weakness); which-tiles-apply and robot advance/detonation; spawn schedule and waiting; shop
RNG determinism and stream separation; save/load round-trip; wave scaling data validity.

---

## 16. Platform and Renderer (Decided)

### 16.1 Platform: Web

TypeScript, mobile Safari, installable to Home Screen. Rationale: deployment is a URL;
Playwright and vitest give agents headless validation; agents are strongest in TypeScript.

Accepted costs: no App Store path without a later Capacitor wrap; iOS Safari friction
(audio unlock on first gesture, gesture interference, tab eviction — all addressed above).

### 16.2 Renderer: React + Phaser 4

- **Phaser 4** (exact version pinned in `CLAUDE.md`) renders everything the player drags or
  watches: grid, tray, tiles, cannons, robots, balls, hints, playback, particles.
- **React** renders everything that is a button or screen, layered over the canvas.
- **Rule of thumb: if you can drag it, it lives in Phaser.**
- A single framework-free store connects them; neither renderer talks to the other directly.

### 16.3 Explicitly Rejected

- Godot / Unity / native engines for v1.
- A physics engine in the simulation.

---

## 17. AI Agent Development

Agent conventions live in `CLAUDE.md`. Architecture lives in `TECHNICAL_REFERENCE.md`.
Work is tracked in `TASKS.md` with one spec per task in `tasks/`.

### 17.1 Milestones

| Milestone | Delivers | Gate |
|---|---|---|
| **M0 Foundation** | Scaffold, CI, Pages + previews, data schemas, store, test handle, app shell | Blank board on the iPad via production URL |
| **M1 Core loop** | Sim (lanes, `±×` tiles, per-ball impact, exact kill), scenario runner, board + tray drag, End Turn, lane playback, hand-authored puzzle levels | **Playtest 1** — is building an equation fun? |
| **M2 A run** | Waves & spawn schedules, advance, base HP & detonation, wave rewards (shop stand-in), win/lose, save/resume, main menu, ladder waves 1–3 | Playtest 2 — does a run hold together? |
| **M3 Economy** | Shop, coins, cannons & upgrades, seen-tiles log, ladder waves 1–7 | Playtest 3 |
| **M4 Traits & finale** | Trait telegraph, ladder swap on 4/6/7, waves 8–10 + Boss, hints toggle, settings | Playtest 4 — complete v1 run |
| **M4.5 Difficulty modes** | Easy / Normal / Hard overlays, New Game picker, leftover bands per mode | A parent can pick a stretch that fits |
| **M5 Juice & art** | Sound (task 31); then escalation, celebrations, art, gallery, title | v1 |

Task specs are written one milestone at a time; later milestones may change after playtests.

### 17.2 Terminology (use exactly)

| Term | Meaning |
|---|---|
| Ball | The projectile. Carries `value`. |
| Cannon | Fires one ball per turn from a cannon slot. |
| Cannon slot | Column 0 cell of a lane; holds at most one cannon. |
| Armed lane | A lane whose cannon slot holds a cannon. |
| Base value | Starting value of every ball; shared by all cannons. |
| Tile | `+N`, `−N`, or `×N` piece placed in columns 1–7. |
| Tray | Owned tiles not on the board. |
| Robot | Enemy unit. |
| Trait | Weakness, Bounce-back, Odd-only, or Even-only. |
| Boss | The wave-10 robot, 1000 HP, 2×2, no trait. |
| Base | Player's structure left of the cannon slots. |
| Detonation | A robot reaching the base; damage = remaining HP. |
| Locked cell | A cell containing a robot; tiles cannot be placed or removed. |
| Turn | Spawn → planning → fire → advance → end check. |
| Wave | A spawn schedule of robots, cleared over multiple turns. |
| Run | 10 waves. |
| Ladder | The fixed concept progression across waves 1–7 (and 10). |
| Exact kill | Reducing a robot to exactly 0 HP. |
| Overkill | Damage exceeding remaining HP. |
| Blocked | A wrong-parity ball; 0 damage, consumed. |
| Hint | Optional running-total numbers under tiles during planning. |
| Difficulty | Easy, Normal, or Hard. Chosen on New Game; locked for the run. |
| Puzzle book | The Puzzles grid of authored scenarios. |
| Puzzle scenario | One catalog entry: 1–5 authored waves, granted kit, no shop. |
| Easy | Quiet stretch: fewer simultaneous robots, lower HP. |
| Normal | The designed ladder (`waves.json` as shipped). |
| Hard | Loud stretch: more simultaneous robots, no `basic` on 8–9. |
| Playback | Presentation performing a resolved event list. |
| Go | HUD fire control (green ▶). Tapping it dispatches End Turn. |
| End Turn | The command that starts FIRE. The HUD label is Go. |

---

## 18. Open Items

All v0.2 open decisions are resolved. Remaining items are **tuning or later-milestone
questions**, not blockers for M0/M1:

| Item | When |
|---|---|
| Concrete HP curves, prices, income values | Tuned in data during M2–M4 playtests |
| **"Guarantees `×2` or `×5`" (§10.2, wave 7): a set, or the range `×2`–`×5`?** A shop guarantee in data is `{ kind, n: [lo, hi] }`, a *range* (TR §9), so `[2, 5]` can also offer `×3` or `×4`. M4 ships the range (any cheap multiply). A literal two-value set needs a new guarantee shape — decide before M5 if the distinction matters | Raised while reviewing the M4 specs; task 25 |
| Playback pacing values | Tuned after Playtest 1 |
| Ladder waves 1–3 authored content | Drafted in task 12; finalized after Playtest 1 (task 17) |
| Ladder waves 4–7 authored templates | Drafted untraited in M3 (task 21); first teaching trait swapped in M4 (task 22) |
| Waves 8–9 procedural table design | Specified in task 25 (`waves.json` `procedural` groups) |
| Browsable seen-tiles gallery | M5, with the art pass (§8.7) |
| Sound sourcing (library vs generated) | **Closed v0.9:** generated Web Audio only (grill S1 A). Task 31 |
| Kid-facing title and art style | M5 |
| Easy / Hard leftover bands | Task 30 tunes `difficulty.json` percents and count deltas; Normal leftover median 50–70 is still unmet (tasks 25/27) |
| Ship M4.5 before or after Playtest 4 | Grill A: after H4, so Playtest 4 measures one ladder. Build 28–29 first if the next session needs Easy |
| v1.1 direction: path tiles/loops vs Splitter/division | After v1 playtesting |

### 18.1 Minor calls made while writing v0.3 (review)

These were not explicitly discussed and were chosen as the simplest consistent option:

- Column 0 is the cannon slot column; robots never enter it; advancing from column 1 detonates.
- A bought cannon auto-places in the topmost empty slot; cannons never enter the tray and
  move only to empty slots.
- The single starting cannon is in lane 2 (center).
- Undo is multi-level within a planning phase and never reverts purchases.
- Weakness applies only to positive values.
- Base HP ≤ 0 loses even if the wave would also clear that turn.
- Tiles may be placed in unarmed lanes (so layouts survive moving the cannon).
- Settings contains planning hints and sound toggles.

### 18.2 Minor calls made while writing v0.7

- Wave 4's Weakness is `n = 5` (skip-counting by fives; grill A). Waves 8–9 mix 2/5/10.
- Wave 7's first parity robot is Odd-only (cannon base value 1 is odd; grill A). Even-only
  can appear from wave 8 T1 (grill B); first-ball clonk is the lesson.
- Wave 5 stays fully `basic` (grill A) — subtraction is the lesson, not a new trait.
- Wave 6's first teaching trait is Bounce-back (grill A). The −N shop after 5 is the exam.
- Shop after wave 7 guarantees `×2` or `×5` (grill A). Heading into the 8–9 mix with a multiply.
- Shop after wave 8 guarantees nothing (grill A). No second gift one shop later.
- Shop after wave 9 guarantees `×5` and `−N`. `×5` is the 1000 HP toolkit; `−N` is last trim.
- Waves 4–7 leftover after wave 7: sensible-player min ≥ 80, and not every seed at 100.
- 10-wave leftover after the Boss: sensible-player min near 40 (still ≥ 40), median 50–70.
  Chips come from waves 8–9 for a sensible player. Wave 10 escort is T1 Bounce-back + T7
  Odd-only and Even-only (kid-facing trap). Leaking the Boss is a loss.
- The Settings gear on the main menu is labelled *Settings* (one extra word beyond the §11.1
  navigation list). The Hints toggle is icon + one word. No Sound row until M5.
- Planning hints are off by default (grill A). The player can turn them on in Settings.
  They show ball value only — no trait effects, blocked/doubled damage, or outcome (grill A).
- No Sound toggle in M4 Settings (grill A). Ship it with M5 audio. `settings.sound` may remain
  in storage, default on, unused.
- Procedural groups draw distinct lanes with `nextInt` into the remaining lanes, then pick a
  template from the remaining pool **without replacement** (grill B) and roll HP — file order,
  `wave` stream only. `count` ≤ unique `pool` length. The T1 clonk is a lesson, not a lottery.
- The Boss is untraited: **1000 HP**, **2×2** occupying lanes 1–2 (starting cannon in lane 2
  hits it). Escort is T1 Bounce-back plus T7 Odd-only and Even-only. This is a multi-turn
  fight; the old ≤ 3-hit exact-kill grill does not apply at 1000 HP.
- A sloppy run can lose on waves 8–9 and never see the Boss. The sensible player always reaches wave 10.
- Both waves 8 and 9 may spawn `basic`. Wave 8 is 3+3 (grill A). Wave 8 T1 and T8 use split
  pools (grill A): T1 is n=5 + both parities + bounce + basic; T8 introduces 2 and 10.
  Wave 9 has more robots overall **and** four at once plus an extra pack (grill C). Wave 9
  uses one shared full mix on every pack (grill A).

### 18.3 Minor calls made while writing v0.8

- Labels are *Easy* / *Normal* / *Hard* with 1 / 2 / 3 stars (grill A). Not Gentle/Tough, not
  a numeric 1–3 without words.
- Default and first highlight: **Normal** (grill A). The designed ladder stays the unmarked
  game.
- New Game **always** opens the picker (grill A). Settings stores the last pick. Continue
  does not re-ask.
- `RunState.difficulty` is `'easy' | 'normal' | 'hard'`. Do not reuse `RunState.mode`
  (`'run' | 'level'`).
- Overlay, not three `waves.json` copies (grill A). Normal is identity: multipliers 100,
  countDelta 0, no pool drops — `rollWave` on Normal is byte-identical to today.
- Easy scales **all** non-Boss HP, including waves 1–3 (they barely move). Hard (v0.9.4)
  scales **procedural** non-Boss HP to **120%** and still adds stretch pressure
  (`countDelta +1`, drop `basic`). Authored waves 1–7 / 10 stay at Normal HP. Parity
  stays 100%.
- Shop, economy, starting kit, Boss 1000 / 2×2 are mode-invariant (grill A).
- Hints stay independent. Easy does not auto-enable them.
- Hard's sensible player still always wins and always reaches wave 10 (grill A). Hard is more
  to think about, not a brick wall.
- Easy's End-Turn-only player still loses. Easy is quieter, not unlosable.
- schemaVersion bumps (4) so a pre-mode save is discarded, not migrated.
- HUD does not show the current difficulty during play (numbers stay the largest element).
- Implement after Playtest 4 (grill A) unless the next session needs Easy.

### 18.4 Minor calls made while writing v0.9 (M5 sound)

- Generated oscillators + bandpassed noise. No sample files (grill S1 A).
- `tilePop` operator colour on the depth curve (grill S2 B): `+` up, `−` down, `×` brighter.
  Depth still rises through a subtract. Ball value never maps to Hz.
- Cannon thump, spawn drop, pickup / drop / snap-back, tray tick, every enabled kid-facing
  button (grill S3 C, plus “all interactions”). Debug is silent.
- Wave-cleared sting quieter than win (grill S4 B). Puzzle `LevelCleared` uses the same quiet
  family.
- Lose sting distinct from win, not sad (grill S5 B).
- Replay plays sound. Skip cuts voices. Mute is on/off; enabling plays a preview.
- No music. No volume slider. No Sound row until the player exists (task 31 ships both).
- Exact-kill sting is a **fixed** figure, not “whatever pitch the chain ended on.”
- Shop buy / nope replace `uiTap` on those cards (do not double). Inert cards stay silent
  (GDD §8.6).
- Aesthetic: soft attack, short decay, sine/triangle + noise. No square, no saw, no long
  reverb. Numbers in `presentation.json`.

### 18.5 Minor calls made while writing v0.9.4 (difficulty tweak)

- Normal hardness is a `waves.json` HP tick on waves 7–9, not a Normal overlay mul — identity
  stays (100 / countDelta 0 / no drops). Waves 4–6 stay put: raising them leaked seed 14
  on the sensible player (wave 5 lost 59).
- Hard's extra notch is stretch non-Boss **120%** via `hpApplies: procedural`. Parity stays
  100% so the 16–32 chip band still holds. Waves 1–7 templates and HP still match Normal.
- Easy percents and `countDelta` stay at the task-30 draft. Do not quiet Easy further unless
  a playtest asks.
- Wave 10 escort and Boss HP stay as shipped on all modes that do not scale authored HP.

---

## 19. Deferred to v1.1+

| Idea | Notes for when it returns |
|---|---|
| **Path tiles** (Redirect, Bounce) | Ship with `transformationCount` cap (~20) and the §14.4 tie-break in the same change. Loops lean "feature". |
| **Splitter / division** | Splits a ball; remainder becomes splash. Division enters spatially, never as `÷`. |
| **Count tiles** (`+1 ball`) | Cut from v1. If revived: copies cannot make copies (additive stacking). |
| **Armor** (separate HP destroyed first) | Playtest 3 idea for waves 9/10. A second number on the robot fights §11.2. Closer to Barrier than to existing traits. |
| **Barrier / Slow tile** | Revisit if playtests show a need to stall. Would reintroduce robot `attack`. |
| **Robot speed > 1** | Interacts with locked cells and equation shrinking. |
| **Stacked traits** | Use §6.5 order. |
| **Piercing balls** | Upgrade idea. |
| **Rerolls, interest, selling** | Excluded from v1 economy. |
| **Next-wave preview in the shop** | Showing the incoming robots would make purchases more purposeful, but it is new design and needs its own legibility pass. |
| **Tuned iPhone layout** | 4×6 grid or panning camera. |
| **"Start at wave N"** | If replaying early ladder waves gets boring. |
| **Per-mode shop tables / income** | v0.8 keeps one shop. Revisit if Easy still feels poor or Hard still feels rich. |
| **Mid-run difficulty change** | Locked at New Game. A second save slot per difficulty would be a new product. |
| **Base HP shop item** | Data-only fix if base HP proves too punishing. |
| **Emergent physics** | Contrary to §14.1; would move physics into `/sim`. |
| **Save migrations** | v1 discards mismatched saves. |
