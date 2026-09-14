# Math Tactics — Game Design Document

**Title:** Math Tactics (v1 working title; a kid-facing name may come with the M5 art pass)
**Version:** 0.3
**Platform:** Web, iPad landscape primary (iPad 10th gen, 10.9"), installable to Home Screen
**Stack:** TypeScript · React (UI) · Phaser 4 (board) — see §16 and `TECHNICAL_REFERENCE.md`
**Audience:** Children, approximately 2nd grade math level (ages 7–8)
**Status:** Design refined, ready for M0. This document is the single source of truth for *design*.
`TECHNICAL_REFERENCE.md` is the source of truth for *architecture*.

---

## 0. Changes in v0.3

v0.3 is the result of a structured design review. Every former `[OPEN DECISION]` is
resolved or explicitly deferred. Major changes from v0.2:

- **Cannons live in a fixed cannon slot column** (col 0), one per lane; tiles occupy cols 1–7.
  Runs start with one cannon and nothing else.
- **Kills resolve per ball**, not at end of turn.
- **Overkill Heal is replaced by Bounce-back**: `hp = min(|hp − damage|, maxHp)`.
- **Parity Shield is reframed** as Odd-only / Even-only robots (show what hurts, not what blocks).
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
- No meta-progression between runs beyond a "seen tiles" collection log.
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
- **Normal robot HP never exceeds 99** (two digits). Only the Boss uses three digits (§6.6).
- No fractions or non-integers exist in v1.

---

## 3. Board

### 3.1 Dimensions and Coordinates

- Grid is **5 lanes × 8 columns**. Lanes are indexed **0–4, top to bottom**.
- **Column 0 is the cannon slot column.** Each lane has exactly one cannon slot.
- **Columns 1–7 are tile cells.**
- The **base** sits to the left of the cannon slot column, spanning all lanes.
- Robots **spawn at column 7** and advance **right to left**.
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

A **wave** is played over multiple **turns**. Only End Turn is a required player action.

```
1. SPAWN         Robots scheduled for this turn (and any robots waiting off-board)
                 enter column 7 of their lane if that cell is free, in schedule order.
                 A robot whose spawn cell is occupied waits off-board (shown as a ghost).
2. PLANNING      Untimed. Player drags tiles between tray and cells, moves cannons
                 between empty cannon slots, uses Undo, may Replay the last turn.
3. FIRE          Player taps End Turn. Each armed lane resolves independently (§5).
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
- Hints never show trait effects, blocked/doubled damage, or the outcome.
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
- Presentation: overshooting makes the robot visibly **bounce back** — its HP bar refills.
  Legible from the bar alone.
- Because HP never exceeds `maxHp`, detonation damage never exceeds `maxHp`.
- Visual design must telegraph the trait loudly (e.g. springy/coiled silhouette).

### 6.3 Trait: Odd-only / Even-only

The robot can only be hurt by balls of one parity. Framed as **what hurts it**.

- **Even-only** robots are built from matched pairs (two antennae, two eyes, paired blocks).
- **Odd-only** robots have one unpaired "odd one out" part (single antenna, single eye).
- The shield glows in the color of the parity that works. HP remains the most prominent element.
- A wrong-parity ball is **blocked**: 0 damage, ball consumed (a "clonk"). It does not
  pass through to robots behind.
- Robot HP is unconstrained by parity. An Odd-only robot with even HP needs two or more
  odd hits (odd + odd = even), possibly across turns.
- Useful facts the player discovers: any odd `+N`/`−N` flips parity; any even `×N`
  forces even; the base cannon value 1 is odd.

### 6.4 Trait: Weakness to Multiples

- The robot displays a number *n* ∈ {2, 5, 10} on its chest.
- A ball whose value is a positive multiple of *n* deals **×2 damage**.
- Exact kill is evaluated on the doubled damage.
- The softest trait: rewards skip-counting fluency, never blocks progress.

### 6.5 Trait Rules

- At most **one** trait per robot in v1.
- Canonical order for future stacking: Parity → Weakness → damage → Bounce-back.

### 6.6 HP Scaling and the Boss

- **Normal robots: 1–99 HP.** Difficulty comes from robot count, simultaneous lanes, and
  traits — not ever-larger numbers.
- Placeholder curve (tuned in data): wave 1 → 1–3, wave 2 → 4–10, wave 5 → ~10–30,
  wave 9 → ~30–99.
- **Boss** (wave 10 only): one robot, 100–150 HP, no trait, visually much larger (occupies
  one cell but its sprite overflows it). Arrives with a light escort of normal robots.
  Detonates for remaining HP like any robot.

---

## 7. The Base

- Starts at **100 HP**. Base HP does **not** regenerate in v1.
- Loss condition: base HP ≤ 0 at the end check (§4 step 5).

### 7.1 Why 100

Round and legible; tracking "how much is left" is itself arithmetic practice. With the
99 HP cap, a single leaked normal robot can never end a run from full health.

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

The shop appears **after every wave except the last**. Never mid-wave. Layout:

- **3 tile offers**
- **1 cannon offer** — only shown while the player owns fewer than 5 cannons
- **1 upgrade offer** — all cannons' base value +1
- A big **"Next wave →"** button

Unbought offers vanish when the shop closes; coins carry over.
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
- Early tables favor small N; the full range opens by around wave 5.
- **Duplicates are allowed**, within and across shop visits.
- Offers use a **dedicated seeded RNG stream**, separate from wave generation, so
  purchases never affect which robots come next.

### 8.6 Purchases

- Bought tiles go to the **tray**.
- A bought cannon is **auto-placed in the topmost empty cannon slot**. Cannons are never in
  the tray.
- An upgrade takes effect immediately for all cannons.

### 8.7 Seen-Tiles Log and NEW Badge

The game tracks which tile types have ever been **offered** on this device. A never-offered
type shows a "NEW" sticker in the shop. This log is the only data persisted across runs.
It is a discovery log, not power progression.

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

### 10.2 Concept Ladder (same every run)

Every run climbs the same ladder. Exact HP values, lanes, timing, and non-guaranteed
shop slots are seeded-random within each rung.

| Wave | Robots | Shop after this wave guarantees | Teaches |
|---|---|---|---|
| 1 | ~3 robots, HP 1–3, one lane at a time, lane varies | `+N` offers only (small N) | Moving the cannon; exact kills (free) |
| 2 | HP 4–10, one lane at a time | at least one `×2` | Placing tiles; addition |
| 3 | Two lanes threatened at once | — (the cannon offer is always present; income should make a 2nd cannon affordable around here) | Lane choice; shop tradeoffs |
| 4 | First **Weakness** robot | at least one `×N` | Multiples |
| 5 | Larger HP (~10–30) | at least one `−N` | Subtraction as a tool |
| 6 | First **Bounce-back** robot | — | Trimming to exact |
| 7 | First **Odd-only / Even-only** robot | — | Odd and even |
| 8–9 | Procedural mix, HP ~30–99, more simultaneous lanes, mixed traits across robots | procedural | Combining everything |
| 10 | **Boss** (100–150 HP) + light escort | — (no shop; win) | The big number |

No tutorial mode and no text popups: wave design does the teaching.

### 10.3 Waves as Spawn Schedules

- A wave is a list of spawn entries: `(turn, lane, robot template)`, where the template
  specifies HP range and trait.
- Robots trickle in over turns. Early waves contain 2–3 robots.
- A wave is **cleared** when every scheduled robot has spawned and none remain (killed or detonated).
- Waves 1–7 are authored templates with seeded variation; waves 8–9 are generated from
  data tables; wave 10 is authored.

### 10.4 Save and Resume

- The run **autosaves after every command** (placement, move, End Turn, purchase).
- On End Turn, the resolved result is saved **immediately**, before playback finishes.
  Reopening mid-playback lands in the next planning phase: no lost progress, no reload exploit.
- Launch screen: big **▶ Continue** if a run exists; smaller **New Run**. No confirmation dialogs.
- Saves carry a schema version. A mismatched save is silently discarded (no migrations in v1).
- The seen-tiles log is stored separately, is additive, and survives version bumps.

---

## 11. UX Requirements for the Target Age

1. **No reading required for core play.** Traits, tile functions, and state must be
   legible from shape and color. Text is supplementary.
2. **Numbers are the largest UI element.** Ball values and robot HP beat art for priority.
3. **Every state change is animated and slow enough to follow.** Never resolve a turn instantly.
4. **No fail-state shaming.** Losing returns cheerfully to the menu.
5. **Undo during planning.** A mis-drag never costs anything.
6. **Big touch targets.** ≥ 60 pt; drag-and-drop tolerates imprecise fingers.
7. **No Safari interference.** No pinch-zoom, pull-to-refresh, swipe-back, or text-selection
   on long-press during play.
8. **Settings** (from main menu): planning hints (off by default), sound on/off.

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
4. Robots **advance together** in one beat.
5. **Detonations** play one at a time.

**Requirements:**

1. **Escalation across a chain.** A five-tile chain feels like a crescendo.
2. **Impact is the payoff.** Screen shake scaled to damage, robot knockback, damage numbers
   flying off and settling.
3. **Exact kills get a unique, unmistakable celebration** — the most satisfying moment in the game.
4. **Bounce-back gets an equally loud negative beat** — the HP bar visibly refills.
5. **Blocked (parity) hits** get a distinct "clonk".
6. **HUD commits follow playback.** Coins and base HP update only when the matching event plays.
7. **Skip:** tapping during playback jumps to the end of the current lane; tapping again skips the next.
8. **Replay:** a HUD button during planning replays the last turn's events (visual only).
9. **Pacing lives in data** (`/data/presentation.json`: ball speed, per-tile pause, lane gap).
   Target: ~2–3 s per active lane + ~1 s advance → ~8–10 s for a 3-lane turn.

### 12.3 Juice Is Presentation-Only

> **Anything that changes a number belongs to the simulation. Anything that only changes how
> it feels belongs to presentation.** Presentation never reports back to the simulation.

---

## 13. Data-Driven Design Requirement

All tunable content lives in JSON data files validated by schema on load. An agent should
never need to edit code to change a number.

Data-defined: tile definitions, robot templates and traits, wave spawn schedules and
procedural tables, HP ranges, shop pricing and offer tables, ladder guarantees, economy
values, starting state, presentation pacing. File list in `TECHNICAL_REFERENCE.md`.

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
| **M2 A run** | Waves & spawn schedules, advance, base HP & detonation, win/lose, save/resume, ladder waves 1–3 | Playtest 2 |
| **M3 Economy** | Shop, coins, cannons & upgrades, seen-tiles log, ladder waves 1–7 | Playtest 3 |
| **M4 Traits & finale** | Weakness, Bounce-back, Odd/Even-only, waves 8–10 + Boss, hints toggle, settings | Playtest 4 — complete v1 run |
| **M5 Juice & art** | Escalation, celebrations, sound, AI art pass | v1 |

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
| Boss | The wave-10 robot, 100–150 HP. |
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
| Playback | Presentation performing a resolved event list. |

---

## 18. Open Items

All v0.2 open decisions are resolved. Remaining items are **tuning or later-milestone
questions**, not blockers for M0/M1:

| Item | When |
|---|---|
| Concrete HP curves, prices, income values | Tuned in data during M2–M4 playtests |
| Playback pacing values | Tuned after Playtest 1 |
| Ladder wave 1–7 authored templates (exact robot counts, timing) | M2/M3 task specs |
| Waves 8–9 procedural table design | M4 task spec |
| Sound sourcing (library vs generated) | M5 |
| Kid-facing title and art style | M5 |
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

---

## 19. Deferred to v1.1+

| Idea | Notes for when it returns |
|---|---|
| **Path tiles** (Redirect, Bounce) | Ship with `transformationCount` cap (~20) and the §14.4 tie-break in the same change. Loops lean "feature". |
| **Splitter / division** | Splits a ball; remainder becomes splash. Division enters spatially, never as `÷`. |
| **Count tiles** (`+1 ball`) | Cut from v1. If revived: copies cannot make copies (additive stacking). |
| **Barrier / Slow tile** | Revisit if playtests show a need to stall. Would reintroduce robot `attack`. |
| **Robot speed > 1** | Interacts with locked cells and equation shrinking. |
| **Stacked traits** | Use §6.5 order. |
| **Piercing balls** | Upgrade idea. |
| **Rerolls, interest, selling** | Excluded from v1 economy. |
| **Tuned iPhone layout** | 4×6 grid or panning camera. |
| **"Start at wave N"** | If replaying early ladder waves gets boring. |
| **Base HP shop item** | Data-only fix if base HP proves too punishing. |
| **Emergent physics** | Contrary to §14.1; would move physics into `/sim`. |
| **Save migrations** | v1 discards mismatched saves. |
