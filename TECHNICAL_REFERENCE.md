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

type Phase = 'planning' | 'shop' | 'won' | 'lost' | 'levelCleared';

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

### 4.1 Mode `level` (M1)

M1 ships hand-authored puzzle levels before waves exist. A level installs a fixed board,
tray, cannons, and stationary robots. In `level` mode `resolveTurn` performs FIRE only
(no advance, no spawn, no base damage); the phase becomes `levelCleared` when no robots
remain. M2 adds the full turn for `mode: 'run'`. Level mode may be retained as a debug/puzzle
mode or removed later — decide at M2.

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
  | { type: 'buyOffer'; slot: ShopSlotId }
  | { type: 'leaveShop' }
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
  return `wrong_phase`).

---

## 6. Turn Resolution

```ts
function resolveTurn(state: RunState, data: GameData): { state: RunState; events: GameEvent[] };
```

Order (GDD §4): **FIRE** (lanes 0→4) → **ADVANCE** (front-most first) → **DETONATE** (lane order)
→ **END CHECK** → if continuing: **SPAWN** for next turn. Spawning for the *next* turn happens at
the end of `resolveTurn` so robots are visible during planning. Wave start (from shop or new run)
emits the first turn's spawns.

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
  | { type: 'LevelCleared'; levelId: string }
  | { type: 'RunWon' }
  | { type: 'RunLost' }
);
```

Notes:
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
| `robots.json` | Robot templates: id, trait, visual key, boss flag |
| `economy.json` | Starting state (base HP, coins, cannon lane, base value), income values, max cannons, schema version |
| `shop.json` | Price table by category; cannon & upgrade price formulas (base + step); per-wave offer tables (weights, N ranges); ladder guarantees |
| `waves.json` | Waves 1–10: authored spawn schedules with HP ranges/traits; procedural tables for 8–9 |
| `levels.json` | M1 hand-authored puzzle levels |
| `presentation.json` | Pacing (ball cell duration, per-tile pause, lane gap, advance duration), escalation curves, colors |

`presentation.json` is loaded by `/game`, but its schema still lives with the others for a single validation pass.

---

## 10. Store (`/game/state`)

Built on `zustand/vanilla` (`createStore`). Framework-agnostic; React binds via `useStore`,
Phaser via `store.subscribe`.

```ts
interface AppState {
  data: GameData;
  run: RunState | null;          // committed simulation truth (already includes resolved turn)
  display: {                     // what the HUD shows; lags `run` during playback
    coins: number;
    baseHp: number;
    waveIndex: number;
  };
  playback: { status: 'idle' | 'playing' | 'replaying'; events: GameEvent[]; cursor: number };
  lastTurn: { before: RunState; events: GameEvent[] } | null;  // Replay snapshot, memory only
  screen: 'menu' | 'game' | 'shop' | 'settings' | 'won' | 'lost' | 'levelSelect';
  settings: { hints: boolean; sound: boolean };
}

interface AppActions {
  dispatch(cmd: Command): { ok: boolean; error?: CommandError };
  commitEvent(e: GameEvent): void;   // playback → display slice only
  finishPlayback(): void;            // display := derived from run
  startReplay(): boolean;            // playback = replaying lastTurn (planning + idle only)
  setSettings(patch: Partial<AppState['settings']>): void;
}
```

Flow:
1. UI/board issues `dispatch(cmd)` → `applyCommand` (pure) → on success: `run = newState`, **persist**.
2. If the command produced resolution events: `playback = { playing, events }`.
3. The Phaser **Director** plays events; for each HUD-relevant event (`CoinsChanged`, `BaseDamaged`,
   `WaveCleared`, …) it calls `commitEvent`, updating `display`.
4. At the end (or on skip-to-end) → `finishPlayback()`; screens advance (e.g. to shop).
5. During planning, Phaser renders the board directly from `run.board`/`run.tray`.

`commitEvent` never touches `run`. Presentation never reports back to the simulation.

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
- Minimum touch target: 60 pt.

### 11.3 Ownership

- **Phaser (`/game/board`):** grid, cannon slots, tray strip, tiles, cannons, robots, balls,
  hints, drag/drop, locked-cell feedback, playback Director, particles.
- **React (`/game/ui`):** HUD (coins, base HP, wave, End Turn, Undo, Replay), shop, main menu,
  settings, win/loss screens, seen-tiles log, rotate-device overlay.

### 11.4 Playback Director

`/game/board/playback/Director.ts`:
- Input: `GameEvent[]`, `presentation.json`.
- Groups events by `group`; plays groups sequentially; highlights the active lane for `fire:lane:*`.
- Tap during playback → finish the current group instantly; next tap skips the next group.
- `skipAll()` (test handle) → apply all remaining events instantly.
- Replay → re-run `lastTurnEvents` against a snapshot of the pre-turn board (visual only):
  the store keeps `lastTurn.before` when a dispatch yields events; `commitEvent` is ignored while
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

Optional keys: `seed`, `baseHp`, `tray` (list of tile ids), `waiting` (off-board robots),
`mode: run`, `waveIndex`, `turn`. The parser lives in `/sim/scenario` (pure); the CLI in `/scripts/sim.ts`.

---

## 13. Persistence

- Storage: `localStorage`.
- **Key scoping:** `mt:<basePath>:<key>`, where `basePath = new URL(import.meta.env.BASE_URL, location.href).pathname`
  (`/` in production, `/pr/pr-12/` in previews). Keys: `run`, `seen`, `settings`.
- `run` = `{ schemaVersion, savedAt, state: RunState }`. On load, `schemaVersion !== data.economy.schemaVersion`
  → discard silently.
- Saved after **every successful command**, including `endTurn` (state already includes the resolved turn).
- `seen` = sorted array of `TileId`, additive; unaffected by schema version.
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
  loadState(state: RunState): void;         // install directly, bypassing menus/shop
  loadScenario(yamlText: string): void;     // install a scenario's initial state
  endTurn(): GameEvent[];
  skipAnimation(): void;                    // finish playback instantly
  isIdle(): boolean;                        // no playback, no tweens pending
  cellToClient(cell: Cell): { x: number; y: number };  // for real pointer-drag e2e tests
};
```

Playwright asserts on structured state. Screenshots are for legibility review only.

---

## 15. Web Shell (validate in M0)

- `index.html`: `viewport` = `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`;
  `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`, theme color.
- `manifest.webmanifest` with **relative** `start_url: "./"` and `scope: "./"`, `display: "standalone"`,
  `orientation: "landscape"`.
- CSS: `html, body { position: fixed; inset: 0; overflow: hidden; overscroll-behavior: none; touch-action: none;
  -webkit-user-select: none; -webkit-touch-callout: none; }`.
- Rotate overlay: React component shown when `innerHeight > innerWidth`.
- Audio: create/resume `AudioContext` on first `pointerdown`. One shared context
  (`/game/state/audio.ts`: `getAudioContext()`, `installAudioUnlock()`), also handed to Phaser via
  `audio.context` so the app never holds two.
- Vite `base: "./"`.

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
