# Math Tactics — Technical Reference

Architecture source of truth. Design rules live in `GDD.md`; agent conventions in `CLAUDE.md`.
Where this document and the GDD disagree on *game rules*, the GDD wins — raise the conflict.

Sections marked **(validate in M0)** are best-current-understanding and must be confirmed
against real library behavior by the implementing task, with deviations recorded in that
task's Completion Notes.

---

## 1. Repo Layout

```
/sim                 Pure TypeScript simulation. No renderer/DOM/framework imports.
  /core              Types, coordinates, RNG
  /commands          Planning & shop commands (applyCommand)
  /resolve           Turn resolution (resolveTurn) and impact rules
  /waves             Spawn schedules, wave generation
  /shop              Offer generation, pricing
  /data              Zod schemas + loader for /data JSON
  /scenario          Scenario parser + runner (pure; CLI wrapper lives in /scripts)
/game
  /state             Framework-free store, persistence, test handle
  /board             Phaser 4: scenes, sprites, drag/drop, playback director
  /ui                React: HUD, shop, menus, settings, overlays
  main.tsx           Entry: mounts Phaser + React, wires store
/data                JSON tuning data (see §9)
/scenarios           *.scenario.yaml rule scenarios (see §12)
/tests               vitest unit tests (mirrors /sim structure)
/e2e                 Playwright tests (WebKit, iPad landscape)
/scripts             Node CLIs (sim runner)
/public              Static assets, manifest, icons, CNAME
/tasks               Task specs (NN-slug.md)
/.github/workflows   ci.yml, deploy-github-pages.yml, pr-preview.yml
```

---

## 2. Layer Rules and Enforcement

| Layer | May import | Must never import |
|---|---|---|
| `/sim` | `/sim`, `zod`, `yaml` (scenario parser only) | `phaser`, `react*`, `/game`, DOM APIs, `Math.random`, `Date.now` |
| `/game/state` | `/sim`, `zustand/vanilla` | `phaser`, `react*` |
| `/game/board` | `/sim` (types + pure helpers), `/game/state`, `phaser` | `react*`, `/game/ui` |
| `/game/ui` | `/sim` (types), `/game/state`, `react*` | `phaser`, `/game/board` |

Enforcement (set up in M0-01):
- **`tsconfig.sim.json`** compiles `/sim` and `/tests` with `"lib": ["ES2023"]` and **no DOM lib**,
  so any DOM reference fails typecheck.
- **ESLint `no-restricted-imports`** per directory for the table above.
- **ESLint `no-restricted-properties`/`no-restricted-globals`** in `/sim`: `Math.random`, `Date.now`,
  `performance`, `setTimeout`.

---

## 3. Coordinates

```ts
type Lane = 0 | 1 | 2 | 3 | 4;          // top → bottom
type Col  = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
interface Cell { lane: Lane; col: Col }
```

- `col 0` = cannon slot. `cols 1–7` = tile cells. Robots spawn at `col 7`.
- Board dimensions (`LANES = 5`, `COLS = 8`) are constants in `/sim/core`, not data — changing them
  is a design change, not tuning.
- Presentation converts `Cell` → pixels. The sim never knows pixels.

---

## 4. Simulation Core Types (sketch)

Names are normative; field details may be refined by tasks (record deviations).

```ts
type TileKind = 'add' | 'sub' | 'mul';
interface TileDef { id: TileId; kind: TileKind; n: number; priceCategory: PriceCategory }
type TileId = `${TileKind}:${number}`;          // e.g. "add:5", "sub:3", "mul:10"

interface TilePiece { pieceId: string; tileId: TileId }   // one physical owned tile

type Trait =
  | { type: 'none' }
  | { type: 'weakness'; n: 2 | 5 | 10 }
  | { type: 'bounceBack' }
  | { type: 'oddOnly' }
  | { type: 'evenOnly' };

interface Robot {
  robotId: string;
  lane: Lane;
  col: Col | null;          // null = waiting off-board
  hp: number;
  maxHp: number;
  trait: Trait;
  isBoss: boolean;
}

interface Board {
  cannons: boolean[];                         // length 5, index = lane
  cells: (string | null)[][];                 // [lane][col] → pieceId; col 0 always null
  robots: Robot[];                            // on-board and waiting
}

type Phase = 'planning' | 'waveCleared' | 'shop' | 'won' | 'lost' | 'levelCleared';
// 'waveCleared' = the celebration screen between waves; its ▶ runs `openShop` (M3) to reach 'shop'.

type ShopSlotId = `tile:${number}` | 'cannon' | 'upgrade';

type ShopOffer =                                   // M3 (task 18); `price` is fixed at roll time
  | { slot: `tile:${number}`; kind: 'tile'; tileId: TileId; price: number; bought: boolean }
  | { slot: 'cannon'; kind: 'cannon'; price: number; bought: boolean; available: boolean }
  | { slot: 'upgrade'; kind: 'upgrade'; price: number; bought: boolean;
      fromValue: number; toValue: number }

interface ShopState {
  afterWave: number;        // 1-based: the wave just cleared (= waveIndex + 1), keyed to shop.json
  offers: ShopOffer[];      // tile slots in order, then 'cannon', then 'upgrade'
}

interface SpawnEntry {                        // rolled at wave start (GDD §10.3) — concrete
  turn: number;                               // 1-based turn within the wave
  lane: Lane;                                 // lane letters already resolved
  robotTemplateId: string;                    // robots.json id
  hp: number;                                 // HP range already rolled; maxHp = hp
}

interface RunState {
  schemaVersion: number;
  mode: 'run' | 'level';                      // 'level' = M1 hand-authored puzzles
  levelId?: string;
  seed: string;
  rng: { wave: RngState; shop: RngState };
  phase: Phase;
  waveIndex: number;                          // 0-based
  turn: number;                               // 1-based within wave
  baseHp: number;
  coins: number;
  cannonBaseValue: number;
  upgradesBought: number;
  exactKills: number;                         // whole run; shown on win/lose screens (GDD §10.6)
  pieces: Record<string, TilePiece>;          // all owned tiles
  tray: string[];                             // pieceIds not on board, display order
  board: Board;
  pendingSpawns: SpawnEntry[];                // remaining schedule for this wave
  undo: PlanningSnapshot[];                   // cleared on EndTurn
  lastTurnEvents: GameEvent[];                // for Replay
  shop: ShopState | null;
  nextIds: { robot: number; piece: number; ball: number };
}
```

All state is plain JSON-serializable data (no classes, Maps, or functions) so it can be
saved, diffed, and installed by the test handle.

`ShopOffer` deliberately carries **no** NEW flag: the seen-tiles log is device-local storage
(§13), not run state, so the badge is computed at the edge in `/game/state` (§10).

### 4.1 Mode `level` (M1)

M1 ships hand-authored puzzle levels before waves exist. A level installs a fixed board,
tray, cannons, and stationary robots. In `level` mode `resolveTurn` performs FIRE only
(no advance, no spawn, no base damage); the phase becomes `levelCleared` when no robots
remain. M2 adds the full turn for `mode: 'run'`.

**Decided in M2: level mode is kept.** It backs the menu's **Puzzles** button and most scenario
files. Level-mode state is never persisted (§13).

---

## 5. Commands

```ts
type Command =
  | { type: 'placeTile'; pieceId: string; to: Cell }       // tray → cell
  | { type: 'moveTile'; from: Cell; to: Cell }             // cell → empty cell
  | { type: 'returnTile'; from: Cell }                     // cell → tray
  | { type: 'moveCannon'; fromLane: Lane; toLane: Lane }   // to empty slot only
  | { type: 'undo' }
  | { type: 'endTurn' }
  | { type: 'openShop' }                                    // M3: waveCleared → shop (rolls offers)
  | { type: 'buyOffer'; slot: ShopSlotId }                  // M3
  | { type: 'nextWave' }                                    // M3: shop → next wave's planning
  | { type: 'newRun'; seed: string }
  | { type: 'loadLevel'; levelId: string };

type CommandError =
  | 'wrong_phase' | 'cell_locked' | 'cell_occupied' | 'not_a_tile_cell'
  | 'no_tile_here' | 'piece_not_in_tray' | 'slot_occupied' | 'no_cannon_here'
  | 'nothing_to_undo' | 'insufficient_coins' | 'offer_unavailable';

function applyCommand(state: RunState | null, cmd: Command, data: GameData):
  | { ok: true; state: RunState; events: GameEvent[] }
  | { ok: false; error: CommandError };
```

- Pure: never mutates the input state.
- Planning commands push a `PlanningSnapshot` (board cells, tray, cannons) onto `undo`.
- `endTurn` calls `resolveTurn` internally and returns its events.
- `state` is `null` before any run exists; only `newRun` and `loadLevel` accept `null` (others
  return `wrong_phase`). Both also accept any existing state and replace it.
- `newRun` builds the starting state from `economy.json` (GDD §10.1), seeds both RNG streams from
  `seed`, starts wave 0 and returns its turn-1 spawn events. The seed is chosen at the edge
  (`/game/state`), never in `/sim`.
- `openShop` requires phase `waveCleared`: rolls this visit's offers once (`rollShop`, `shop` stream),
  stores them in `state.shop`, phase `shop`, and returns **no events** — there is nothing for the board
  to play. Rolling once here is what makes a reopened app show the same offers (GDD §8.5).
- `buyOffer` requires phase `shop`. `offer_unavailable` for an unknown slot, an already-bought slot, or
  the cannon slot at `maxCannons`; `insufficient_coins` below the offer's price. On success it deducts
  coins, marks the slot `bought`, applies the effect (§7), and never advances `rng.shop`.
- `nextWave` requires phase `shop` (M3; it was `waveCleared` in M2, before the shop sat between them):
  `shop: null`, `waveIndex += 1`, `turn = 1`, roll the wave, spawn turn 1, phase `planning`, returns the
  spawn events. Unbought offers vanish with the `ShopState`. `newRun` and `nextWave` set
  `lastTurnEvents: []`, so Replay is off until the wave's first End Turn.
- **`leaveShop` was removed** (it appeared in the M2 sketch): leaving the shop *is* starting the next
  wave in v1, and two commands for one job drift apart.

---

## 6. Turn Resolution

```ts
function resolveTurn(state: RunState, data: GameData): { state: RunState; events: GameEvent[] };
```

Order (GDD §4): **FIRE** (lanes 0→4) → **ADVANCE** (front-most first) → **DETONATE** (lane order)
→ **END CHECK** → if continuing: **SPAWN** for next turn. Spawning for the *next* turn happens at
the end of `resolveTurn` so robots are visible during planning. Wave start (`newRun`/`nextWave`)
emits the first turn's spawns.

`mode: 'run'` details (M2, task 13):

- **ADVANCE:** on-board robots in order `(col asc, lane asc)`. A robot on col 1 leaves the board and
  is queued to detonate; its cell is free for robots behind it this same step. Otherwise it moves to
  `col − 1` if no robot is there (`RobotAdvanced`), else stays (no event). Waiting robots don't advance.
  Group `"advance"`.
- **DETONATE:** queued robots in lane order: `RobotDetonated { damage: hp }` then `BaseDamaged`.
  Group `"detonate:<lane>"`. `baseHp` may go negative in state; displays clamp at 0.
- **END CHECK** (group `"end"`): `baseHp ≤ 0` → `RunLost`, phase `lost`. Else if `pendingSpawns` and
  `board.robots` (including waiting) are both empty → `WaveCleared`, `CoinsChanged(waveCleared)`; then
  if it was the last wave in `waves.json` → `RunWon`, phase `won`; else phase `waveCleared`. Else
  continue. (M2 also emitted `TilesGranted` here for the wave's authored reward tiles; M3 removed
  rewards — the shop is the only tile source.)
- **Continue:** `turn += 1`. **Fast-forward** (GDD §4.4): if `board.robots` is empty and the first
  pending entry's `turn` is later, set `turn` to it.
- **SPAWN** (group `"spawn"`): first waiting robots (in `board.robots` order), then pending entries
  with `turn ≤ state.turn` (in order, removed from `pendingSpawns`). Each enters col 7 of its lane if
  no robot is there (`RobotSpawned`), else waits with `col: null` (`RobotWaiting`, new robots only). A
  waiting robot that enters emits `RobotSpawned` with its existing `robotId`.
- **Rolling a wave** (`/sim/waves/rollWave.ts`, `wave` stream): letters in order of first appearance
  each take `nextInt` over the lanes still free (not fixed in this wave, not already taken); then each
  entry's HP in file order. Result sorted by `turn` (stable). Exact draw order is normative so saves
  and scenarios are reproducible.

Impact rules are implemented once in `/sim/resolve/impact.ts` as a pure function
`resolveImpact(robot, ballValue) → ImpactOutcome`, exactly per GDD §5.4.

---

## 7. Events

Every event carries:

```ts
interface EventBase {
  step: number;      // strictly increasing within one resolution, starting at 0
  group: string;     // concurrency/playback group: "fire:lane:2", "advance", "detonate:3", "spawn", "end"
}
```

Events sharing a `group` belong to one playback segment. Presentation plays groups in order,
and may play events within a group together or staggered. **No durations in events.**

```ts
type GameEvent = EventBase & (
  | { type: 'LaneStarted'; lane: Lane }
  | { type: 'BallFired'; ballId: string; lane: Lane; at: Cell; value: number }
  | { type: 'BallMoved'; ballId: string; lane: Lane; from: Cell; to: Cell }
  | { type: 'BallTransformed'; ballId: string; at: Cell; tileId: TileId; pieceId: string;
      oldValue: number; newValue: number; chainDepth: number }
  | { type: 'BallExited'; ballId: string; lane: Lane; at: Cell }
  | { type: 'BallBlocked'; ballId: string; robotId: string; at: Cell; value: number;
      reason: 'oddOnly' | 'evenOnly' }
  | { type: 'RobotDamaged'; robotId: string; ballId: string; at: Cell; ballValue: number;
      damage: number; doubled: boolean; hpBefore: number; hpAfter: number }
  | { type: 'RobotBouncedBack'; robotId: string; at: Cell; hpBefore: number; hpAfter: number;
      overshoot: number }
  | { type: 'RobotDefeated'; robotId: string; at: Cell; exact: boolean }
  | { type: 'CoinsChanged'; delta: number; total: number;
      reason: 'kill' | 'exactKill' | 'waveCleared' | 'purchase' }
  | { type: 'LaneEnded'; lane: Lane }
  | { type: 'RobotAdvanced'; robotId: string; from: Cell; to: Cell }
  | { type: 'RobotDetonated'; robotId: string; lane: Lane; damage: number }
  | { type: 'BaseDamaged'; amount: number; hpBefore: number; hpAfter: number }
  | { type: 'RobotSpawned'; robotId: string; at: Cell; hp: number; maxHp: number;
      trait: Trait; isBoss: boolean }
  | { type: 'RobotWaiting'; robotId: string; lane: Lane; hp: number; maxHp: number; trait: Trait }
  | { type: 'WaveCleared'; waveIndex: number }
  | { type: 'TilesGranted'; tiles: { pieceId: string; tileId: TileId }[] }   // tiles entered the tray
  | { type: 'OfferBought'; slot: ShopSlotId; kind: 'tile' | 'cannon' | 'upgrade'; price: number }
  | { type: 'CannonPlaced'; lane: Lane }
  | { type: 'BaseValueChanged'; from: number; to: number }
  | { type: 'LevelCleared'; levelId: string }
  | { type: 'RunWon' }
  | { type: 'RunLost' }
);
```

Notes:
- One `buyOffer` emits, in group `"shop"`: `OfferBought` → the effect event (`TilesGranted` for a tile,
  `CannonPlaced` for a cannon, `BaseValueChanged` for an upgrade) → `CoinsChanged(purchase)`. These are
  for tests and scenarios; the store does **not** play them back (§10).
- `TilesGranted` is the one event for "tiles entered the tray". It carried M2's wave rewards and now
  carries shop purchases.
- `BallMoved` is emitted per cell. Presentation interpolates between cell centers.
- `RobotDamaged` precedes `RobotBouncedBack` / `RobotDefeated` for the same hit.
- For Bounce-back, `RobotDamaged.hpAfter` is the post-bounce HP; `RobotBouncedBack` is emitted only
  when `damage > hpBefore` (an overshoot), so presentation can play the refill beat.
- Tests assert on events with a helper that matches an **ordered subsequence** of partial events,
  so tests don't break when unrelated events are added.

---

## 8. RNG

- Seeded PRNG implemented in `/sim/core/rng.ts` (e.g. sfc32 seeded via a string hash).
- State is plain numbers (`RngState = [number, number, number, number]`), stored in `RunState`.
- API is pure: `nextInt(state, min, max) → [value, newState]`; `pickWeighted(state, items) → [item, newState]`.
- **Two streams:** `wave` (robot HP, lanes, timing, procedural waves) and `shop` (offers).
  Purchasing must never advance the `wave` stream.
- `Math.random` is banned in `/sim` by lint.

---

## 9. Data Files

All files in `/data`, JSON, validated by Zod schemas in `/sim/data/schemas.ts`. `parseGameData(raw)`
(`/sim/data/load.ts`) validates everything and throws with a readable path on failure. `raw` is
already-parsed JSON keyed by file base name — the browser build gets it from Vite JSON imports
(`/game/state/gameData.ts`), and tests/CLIs get it from the disk helper `loadRawGameData()`
(`/tests/helpers/loadDataFiles.ts`). A vitest test loads the real `/data` directory so bad data
fails `npm test`.

| File | Contents |
|---|---|
| `tiles.json` | 29 tile definitions: id, kind, n, priceCategory, color key |
| `robots.json` | Robot templates: id, trait, visual key, boss flag (M2 ships one: `basic`, no trait) |
| `economy.json` | Starting state (base HP, coins, cannon lane, base value), income values, max cannons, schema version (3 from M3) |
| `shop.json` | Price table by category; cannon & upgrade price formulas (base + step); per-wave offer tables (weights, N ranges); ladder guarantees (below) |
| `waves.json` | Waves in run order (run length = array length): authored spawn schedules (below); procedural tables for 8–9 arrive in M4 |
| `levels.json` | M1 hand-authored puzzle levels, played in file order (task 11) |
| `presentation.json` | Pacing (ball cell duration, per-tile pause, lane gap, advance duration), escalation curves, colors, drag feel, React screen pop-in (`screens`), HUD Go colour and idle-nudge (`hud`) |

`presentation.json` is loaded by `/game`, but its schema still lives with the others for a single validation pass.

`waves.json` authored wave:

```json
{
  "waves": [
    {
      "id": "wave-3",
      "spawns": [
        { "turn": 1, "lane": "A", "robot": "basic", "hp": [4, 10] },
        { "turn": 1, "lane": "B", "robot": "basic", "hp": [4, 10] },
        { "turn": 6, "lane": 0,   "robot": "basic", "hp": [5, 12] }
      ]
    }
  ]
}
```

Validation: at least one wave; each wave has ≥ 1 spawn and one with `turn: 1`; `lane` is 0–4 or
`A`–`E`; distinct letters ≤ lanes not fixed in that wave; `hp` is `[min, max]` with
`1 ≤ min ≤ max ≤ 99`; `robot` names a `robots.json` id.

M2's `reward` key (tile ids granted to the tray on wave clear) was removed in M3 along with its
validation — the shop is the only tile source.

`shop.json` (M3, task 18). `afterWave` is **1-based** — the number of the wave just cleared, which
is `waveIndex + 1`; every other wave reference in the codebase is 0-based, so conversions are
commented at the boundary:

```json
{
  "tileSlots": 3,
  "prices": { "add": 4, "sub": 4, "mulLow": 6, "mulHigh": 9 },
  "cannon": { "base": 10, "step": 5 },
  "upgrade": { "base": 12, "step": 6 },
  "shops": [
    {
      "afterWave": 2,
      "guarantees": [{ "tileId": "mul:2" }],
      "table": [
        { "kind": "add", "n": [1, 10], "weight": 8 },
        { "kind": "sub", "n": [1, 5],  "weight": 3 },
        { "kind": "mul", "n": [2, 3],  "weight": 2 }
      ]
    }
  ]
}
```

A guarantee is `{ tileId }` or `{ kind, n? }`. Prices: `tilePrice` = `prices[priceCategory]`,
`cannonPrice` = `cannon.base + cannon.step × (cannonsOwned − 1)` where `cannonsOwned` is
`board.cannons.filter(Boolean).length`, `upgradePrice` =
`upgrade.base + upgrade.step × upgradesBought`.

Validation: `afterWave` values are unique; `{1 … waves.length − 1} ⊆ afterWave set` so every
non-final wave has a table (adding waves 8–10 without their tables fails loudly). Extra tables
for waves that do not exist yet are allowed (M3 ships six shops before waves 4–7 exist).
`prices` covers every `priceCategory` in `tiles.json`; tables non-empty with positive integer
weights; `n` ranges inside the kind's legal range (`add`/`sub` 1–10, `mul` 2–10) and every id in
range present in `tiles.json`; `guarantees.length ≤ tileSlots`; every guarantee satisfiable by its
own table.

**`rollShop` draw order is normative** (saves and scenarios must reproduce): guaranteed tile slots
left to right, then remaining tile slots left to right from the whole table, then the cannon and
upgrade offers, which are computed rather than drawn. Only the `shop` stream is ever touched.
Guarantee matching: `{ tileId }` emits that tile and consumes no randomness; `{ kind }`
`pickWeighted`s over table entries of that kind, then `nextInt` over the entry's full `n` range;
`{ kind, n: [lo, hi] }` `pickWeighted`s over overlapping entries of that kind, then `nextInt` over
the **intersection** of the entry's range and `[lo, hi]`. Every offer starts `bought: false`. An
unknown `afterWave` throws.

---

## 10. Store (`/game/state`)

Built on `zustand/vanilla` (`createStore`). Framework-agnostic; React binds via `useStore`,
Phaser via `store.subscribe`.

```ts
interface AppState {
  data: GameData;
  run: RunState | null;          // committed simulation truth (already includes resolved turn)
  savedRun: RunState | null;     // memory copy of the `run` storage key (task 14 — see below)
  display: {                     // what the HUD shows; lags `run` during playback
    coins: number;
    baseHp: number;
    waveIndex: number;
  };
  playback: {
    status: 'idle' | 'playing' | 'replaying'; events: GameEvent[]; cursor: number;
    before?: RunState;           // where the board starts this sequence (absent when idle) — see flow step 2
  };
  lastTurn: { before: RunState; events: GameEvent[] } | null;  // Replay snapshot, memory only
  shopNew: TileId[];             // tile types this shop visit offered for the first time (M3, §13)
  screen: 'menu' | 'game' | 'shop' | 'settings' | 'won' | 'lost' | 'levelSelect' | 'allDone';
  // the wave-cleared overlay is derived (run.phase === 'waveCleared' && playback idle), like level-cleared
  settings: { hints: boolean; sound: boolean };
}

interface AppActions {
  dispatch(cmd: Command): { ok: boolean; error?: CommandError };
  commitEvent(e: GameEvent): void;   // playback → display slice only
  finishPlayback(): void;            // display := derived from run
  startReplay(): boolean;            // playback = replaying lastTurn (planning + idle only)
  setSettings(patch: Partial<AppState['settings']>): void;
  setScreen(screen: AppState['screen']): void;  // never touches `run`
}
```

Flow:
1. UI/board issues `dispatch(cmd)` → `applyCommand` (pure) → on success: `run = newState`, **persist**.
2. If the command produced resolution events **and the resulting phase is not `shop`**:
   `playback = { playing, events, before }`. `before` is the
   run as it was for a normal turn; for `newRun`/`nextWave` (`sequenceStart`) it is the new run minus
   the robots its own spawn events introduce — so New Run never plays over the previous run's or
   puzzle's board (robot ids restart at `robot:0`), and `nextWave` starts from the board as the cleared
   wave left it (tiles and cannons in place, no robots).
   Those two commands also set `display` from the new run at once (their spawns carry no HUD events).
3. The Phaser **Director** plays events; for each HUD-relevant event (`CoinsChanged`, `BaseDamaged`,
   `WaveCleared`, …) it calls `commitEvent`, updating `display`.
4. At the end (or on skip-to-end) → `finishPlayback()`; screens advance (e.g. to shop).
5. During planning, Phaser renders the board directly from `run.board`/`run.tray`.

`commitEvent` never touches `run`. Presentation never reports back to the simulation.

**M3 shop flow (task 19, `/game/state/shopFlow.ts`):** `openShopScreen` (guards phase `waveCleared`,
dispatches `openShop`, `screen: 'shop'`), `buyOffer(store, slot)`, `leaveShopToNextWave` (guards phase
`shop`, dispatches `nextWave`, `screen: 'game'`), `shopOffers(state)`. Every entry point guards on phase
so a double tap cannot open two shops or start two waves — the UI never relies on `wrong_phase` for its
own state (task 16's rule). A dispatch whose **result phase is `shop`** never starts playback: a purchase
has no board beat and the board is behind a full screen, so `display` is committed from the new run at
once, as it already is for `newRun`/`nextWave`. A purchase leaves `lastTurnEvents` alone, so the Replay
snapshot survives a shop visit. `isResumable` (`runFlow.ts`) accepts phase `shop`, and `continueRun` lands
on `screen: 'shop'` for such a run — the same offers, the same bought slots. There is no ⌂ Home in the
shop (the HUD renders only on `screen: 'game'`); the run is saved in phase `shop`, so ▶ Continue returns
to it. `shopNew` is filled when the shop opens — the offered tile ids not already in the `seen` log (§13),
which are written to that log at the same moment — and cleared when the shop closes. It is memory-only, so
a reload inside the shop loses the NEW stickers; device-local state must not enter `RunState`. Storage is
closed over in `createAppStore`; `openShopScreen` calls store action `recordShopVisit` rather than taking
a `StorageLike` (task 20).

**M1 level flow (task 11, `/game/state/levelFlow.ts`):** the app opens on `screen: 'menu'`. ▶ Play and
▶ Play again → `loadLevel` (first level) + `'game'`. The level-cleared overlay shows when
`run.phase === 'levelCleared'` and playback is idle (`showLevelCleared`); ▶ Next → `loadLevel` the next
level, or `'allDone'` after the last. Progress is just `run.levelId` in memory; a run restored from
storage is not resumed by the menu in M1. In level mode the HUD shows level dots instead of wave and
base HP.

**M2 run flow (task 14, `/game/state/runFlow.ts`):** menu shows ▶ Continue (`canContinue`) when a
resumable run is saved (mode `run`, phase `planning` or `waveCleared`, `isResumable`), New Run
(`startNewRun`: `dispatch({ type: 'newRun', seed })` with a seed made at the edge from the clock/
`crypto`, never in `/sim`), and Puzzles (the level flow above, unchanged). `continueRun` installs
the saved run as-is — the wave-cleared overlay reappears if it was saved there — with no playback
and no Replay snapshot.

`dispatch` only persists a `mode: 'run'` result (`saveRun`); a level-mode result (Puzzles) never
writes or removes the `run` key. `AppState.savedRun` is a memory copy of that same key, updated in
lock-step by `dispatch` and `finishPlayback` — `runFlow.ts`'s `canContinue`/`continueRun` read
`savedRun`, not a fresh storage read, so Continue keeps offering the saved run after `run` has been
replaced by a Puzzle for the current session. When a run's playback finishes on phase `won`/`lost`,
`finishPlayback` itself switches `screen` to match and clears the save (`clearRun`) — the same
treatment a `won`/`lost` save gets if found on boot (not resumable, cleared immediately). `goHome`
sets `screen: 'menu'`, refused only while playback is active; a run is already saved, and a puzzle
session is simply dropped (`run`/`savedRun` untouched).

The HUD's ⌂ Home button is shown whenever playback is idle, except while the run-mode wave-cleared
overlay is up (`hudButtons(state).home` in `/game/ui/hudButtons.ts` calls `showWaveCleared` from
`/game/state/waveFlow.ts`, so the condition is defined once). When hidden it keeps its slot
(`visibility: hidden`, disabled), so the dots, ♥ and 🪙 never shift. In run
mode the HUD shows wave dots (`LevelDots`, reusing task 11's component; count = `waves.json`
length, current = `waveIndex`) and ♥ base HP clamped at 0 for display only (`baseHp` itself is
never clamped, TR §7).

---

## 11. Rendering Boundary

### 11.1 DOM structure

```html
<div id="app">
  <div id="board-root"></div>                <!-- Phaser canvas -->
  <div id="ui-root"></div>                   <!-- React; pointer-events: none on container -->
</div>
```

React interactive elements set `pointer-events: auto`. Everything else passes through to the canvas.

### 11.2 Scaling (validated in M0-03)

- Design space: **1180 × 820 pt** (iPad 10th gen landscape).
- Phaser game size is design space × 2 (**2360 × 1640**) with `Scale.FIT` + `CENTER_BOTH`,
  so text and shapes are crisp on 2× displays.
- **Decision (M0-03): `UNIT = 2` multiplier, not camera zoom.** Board layout code works in design
  points and converts at the point of drawing with `designToWorld()` / `worldToDesign()` from
  `/game/board/layout.ts`, which also holds all board geometry (`GRID`, `BASE_STRIP`, `TRAY`,
  `cellRect(lane, col)`, …). Why: Phaser 4 `Text` rasterises at `resolution` 1 unless set per
  object (there is no game-wide default), so under a 2× camera zoom every Text would need
  `setResolution(2)` or silently render blurry on the iPad. With `UNIT`, a 48 pt label is a 96 px
  font drawn 1:1 into the 2× backing canvas, and a forgotten conversion is obviously half-size
  rather than subtly soft. Cost: pointer world coordinates are world pixels — convert with
  `worldToDesign()`.
- Design-space constants both renderers need (`DESIGN_WIDTH/HEIGHT`, `HUD_BAR`, `MIN_TOUCH_TARGET`,
  `placementOverCanvas()`) live in framework-free `/game/state/designSpace.ts`, since `/game/board`
  and `/game/ui` may not import each other. The board lays out below `HUD_BAR`.
- `#ui-root` is a fixed 1180×820 box with `transform: translate(…) scale(canvasWidth / 1180)`,
  re-placed from the canvas's `getBoundingClientRect()` on Phaser's `READY` and scale `RESIZE`
  events (`game/main.tsx`), so a React element at design `(x, y)` sits over Phaser point `(x, y)`.
  Viewport-sized React overlays (rotate overlay) portal to `<body>` so the transform doesn't apply.
- A `ResizeObserver` on `#board-root` re-measures and re-fits the canvas whenever the parent
  changes size (`/game/board/refitOnResize.ts`). Phaser alone leaves the canvas oversized after
  rotating an iPhone Home Screen app from portrait to landscape: it fits to the stale portrait
  height, then records the new size without re-fitting.
- Minimum touch target: 60 pt.

### 11.3 Ownership

- **Phaser (`/game/board`):** grid, cannon slots, tray strip, tiles, cannons, robots, balls,
  hints, drag/drop, locked-cell feedback, playback Director, particles.
- **React (`/game/ui`):** HUD (coins, base HP, wave, Go, Undo, Replay), shop, main menu,
  settings, win/loss screens, seen-tiles log, rotate-device overlay.

### 11.3.1 Drag pointer recovery

`DragController` tracks one live pointer (task 09: ignore extra fingers). Phaser 4's default
touch pool is a single Pointer that stays `active` until a matching `touchend`/`touchcancel`. If
that end is lost (iOS Control Center, a React overlay, Safari reusing a `Touch.identifier`),
later `touchstart`s are dropped and tiles/cannons freeze. iOS may also synthesize a mouse down
after a tap and never send mouseup, which latches the same controller.

Recovery (rules in Phaser-free `/game/board/pointerSync.ts`, wired from `DragController.attach`):
- capture-phase `touchstart` frees stale Phaser touch Pointers *before* Phaser assigns the new
  finger (including identifier reuse);
- bubble-phase `touchend`/`touchcancel` frees any Pointer Phaser still has `active` after the
  surface is empty;
- a new `pointerdown` restarts the gesture when the tracked pointer is stale, the same slot is
  reused, or a real touch preempts a *stationary* latched mouse (iOS ghost mousedown; a mouse
  that has already moved is a live drag, so extra fingers stay ignored);
- Phaser `hidden`/`blur` cancel the drag and `resetPointers()`.

### 11.4 Playback Director

`/game/board/playback/Director.ts`:
- Input: `GameEvent[]`, `presentation.json`.
- Groups events by `group`; plays groups sequentially; highlights the active lane for `fire:lane:*`.
- Tap during playback → finish the current group instantly; next tap skips the next group.
- `skipAll()` (test handle) → apply all remaining events instantly.
- Every sequence starts by syncing the board to `playback.before` (flow step 2 in §10), then plays.
- Replay → re-run `lastTurnEvents` against a snapshot of the pre-turn board (visual only):
  the store keeps `lastTurn.before` when a dispatch yields events and a Replay's
  `playback.before` is that snapshot; `commitEvent` is ignored while
  `playback.status === 'replaying'`. After a reload there is no snapshot, so Replay is disabled.
- Beat timing is computed Phaser-free in `playback/timeline.ts` (from `presentation.json`
  `pacing` + `playback`); `playback/SegmentPlayer.ts` draws one segment's beats and its final
  state on skip.

---

## 12. Scenario Files

Plain-text, human-authorable rule tests. `npm run sim -- <file-or-dir>` runs them and prints a
diff; a vitest file runs every scenario so `npm test` covers them.

```yaml
# scenarios/core/exact-kill-order-of-operations.scenario.yaml
name: (1 + 4) × 3 − 2 is an exact kill on 13 HP
mode: level
baseValue: 1
coins: 0
board:
  # tokens per column, col0..col7, space-separated
  # C = cannon, . = empty, +N / -N / xN = tile, R<hp> = robot, R<hp>[tile] = robot on tile
  # traits: R<hp>:bb (bounce-back), R<hp>:odd, R<hp>:even, R<hp>:w2|w5|w10
  - ". . . . . . . ."
  - ". . . . . . . ."
  - "C +4 x3 -2 . R13 . ."
  - ". . . . . . . ."
  - ". . . . . . . ."
commands:
  - endTurn
expectEvents:            # ordered subsequence, partial match
  - { type: BallTransformed, newValue: 5 }
  - { type: BallTransformed, newValue: 15 }
  - { type: BallTransformed, newValue: 13 }
  - { type: RobotDefeated, exact: true }
  - { type: CoinsChanged, delta: 2 }
expectState:             # partial match on RunState after commands
  coins: 2
  phase: levelCleared
```

A scenario starts from exactly one of `board` (+ required `baseValue`, optional `tray`) or
`level: <levelId>` — a shipped level from `data/levels.json`, built with `buildLevelState`; `level`
cannot be combined with `board`, `baseValue` or `tray`. `/scenarios/levels/NN-*.scenario.yaml` prove
each shipped level solvable with all-exact kills (`tests/levelSolutions.test.ts` checks the full event list).

Optional keys: `seed`, `baseHp`, `tray` (list of tile ids), `waiting` (off-board robots),
`mode: run`, `waveIndex`, `turn`. M2 (task 13) adds `pendingSpawns` (concrete entries:
`{ turn, lane, hp, robot? }`), `exactKills`, and `waves` (an inline `waves.json` array replacing the
shipped waves for that scenario, so rule scenarios don't break when ladder content is tuned).
Commands gain `nextWave` and `{ newRun: <seed> }`.

M3 (task 19) adds `phase: shop` (a `phase: shop` scenario without `shop:` is an error), an inline `shop:`
list of `ShopOffer` objects (installed as `RunState.shop = { afterWave: waveIndex + 1, offers }`, pinning
exact offers so a shop scenario doesn't depend on the RNG), `cannons` (length-5 boolean array overriding
`board.cannons`), `upgradesBought`, the string command `openShop`, the shorthand `{ buy: "tile:0" }` /
`{ buy: "cannon" }` / `{ buy: "upgrade" }` (and the full `{ type: 'buyOffer', slot }` object), and
`expectState.shop`.

The parser lives in `/sim/scenario` (pure); the CLI in `/scripts/sim.ts`.

---

## 13. Persistence

- Storage: `localStorage`.
- **Key scoping:** `mt:<basePath>:<key>`, where `basePath = new URL(import.meta.env.BASE_URL, location.href).pathname`
  (`/` in production, `/pr/pr-12/` in previews). Keys: `run`, `seen`, `settings`.
- `run` = `{ schemaVersion, savedAt, state: RunState }`. On load, `schemaVersion !== data.economy.schemaVersion`
  → discard silently.
- Saved after **every successful command** in `mode: 'run'`, including `endTurn` (state already includes the
  resolved turn). **Level-mode (Puzzles) state is never saved** and never overwrites `run`.
- A run whose phase is `won` or `lost` is not resumable; the key is removed once its end screen shows
  (and ignored by Continue if the app closed first). Phases `planning`, `waveCleared` and `shop` resume.
- `seen` = sorted array of `TileId`, additive; unaffected by schema version. Written when a shop opens,
  for its tile offers only (GDD §8.7); read by `/game/state` to decide NEW stickers (§10).
- All access wrapped in try/catch; storage failure never breaks play.

---

## 14. Test Handle

Enabled when `import.meta.env.DEV || import.meta.env.VITE_TEST_HANDLE === '1'`. Loaded via a guarded
dynamic import so it is tree-shaken from production.

```ts
window.__GAME__ = {
  getState(): RunState | null;
  getDisplay(): AppState['display'];
  getScreen(): AppState['screen'];
  getEvents(): GameEvent[];                 // last resolved turn
  dispatch(cmd: Command): { ok: boolean; error?: CommandError };
  loadState(state: RunState): void;         // install directly, bypassing menus/shop (screen → 'game')
  loadScenario(yamlText: string): void;     // install a scenario's initial state; its `waves:` (if any)
                                            // replaces the shipped waves until the next load/reload
  endTurn(): GameEvent[];
  skipAnimation(): void;                    // finish playback instantly
  isIdle(): boolean;                        // no playback, no tweens pending
  cellToClient(cell: Cell): { x: number; y: number };  // for real pointer-drag e2e tests
  renderedBoard(): {                        // what the board draws now (e.g. mid-playback)
    robots: { robotId: string; x: number; y: number }[];  // view centres, client coords
    tiles: string[];                        // piece ids with a tile view
  };
};
```

Playwright asserts on structured state. Screenshots are for legibility review only.

**`loadState` stays storage-free (task 14 req. 6):** it installs `state` directly via
`store.setState`, the same as `loadScenario` — neither ever calls `saveRun`/`clearRun`, and
neither touches `savedRun`. Installing a state this way is invisible to Continue/the `run` save;
only a real `dispatch` (e.g. `endTurn()`, or `dispatch({ type: 'newRun', seed })`) persists.

---

## 15. Web Shell (validate in M0)

- `index.html`: `viewport` = `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`;
  `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`, theme color.
- `manifest.webmanifest` with **relative** `start_url: "./"` and `scope: "./"`, `display: "standalone"`,
  `orientation: "landscape"`.
- CSS: `html, body { position: fixed; inset: 0; overflow: clip; overscroll-behavior: none; touch-action: none;
  -webkit-user-select: none; -webkit-touch-callout: none; }`.
- Rotate overlay: React component shown when `innerHeight > innerWidth`.
- Audio: create/resume `AudioContext` on first `pointerdown`. One shared context
  (`/game/state/audio.ts`: `getAudioContext()`, `installAudioUnlock()`), also handed to Phaser via
  `audio.context` so the app never holds two.
- Vite `base: "./"`.
- **Update detection (production only):** each deploy to `main` stamps `import.meta.env.VITE_BUILD_ID`
  (full `GITHUB_SHA`) and emits `version.json` plus `<meta name="mt-build-id">` in `index.html`.
  On production (`basePath === '/'`), the client polls `version.json` every 5 minutes and on
  `visibilitychange` / `pageshow`; if the fetch fails, it falls back to parsing the meta tag from
  `index.html`. When a newer build is found, React shows a bottom banner (“Update available” /
  Reload). Dismiss hides it until the next time the page becomes visible. PR previews and dev skip
  checks. Reload is a full page refresh (save/resume is not required for the prompt).

---

## 16. CI/CD

Modeled on `ttsu/bee-happy`.

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | pull_request, push to main | `npm ci` → typecheck → lint → test → build → Playwright WebKit e2e (build with `VITE_TEST_HANDLE=1`, serve via `vite preview`) |
| `deploy-github-pages.yml` | push to main | build (no test handle) → `JamesIves/github-pages-deploy-action@v4` to `gh-pages`, `clean-exclude: pr` |
| `pr-preview.yml` | pull_request opened/reopened/synchronize/closed | build with `VITE_TEST_HANDLE=1` → `rossjrw/pr-preview-action@v1`, `umbrella-dir: pr`, `pages-base-url: mathtactics.timtsu.com` |

- `public/CNAME` contains `mathtactics.timtsu.com`.
- Node version from `.nvmrc` (24).
- **Human setup (not automatable by agents):** DNS `CNAME mathtactics → ttsu.github.io`; repo Settings → Pages →
  source `gh-pages` branch, custom domain, enforce HTTPS; Settings → Branches → require CI on `main`.

### 16.1 Playwright

- Project: `webkit`, `viewport: { width: 1180, height: 820 }`, `deviceScaleFactor: 2`, `isMobile: true`,
  `hasTouch: true` (start from Playwright's closest iPad landscape descriptor, override viewport).
- Browsers installed in CI via `npx playwright install --with-deps webkit`.
