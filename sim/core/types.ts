// Core simulation types (TR §4 sketch, §5 commands, §7 events). Types only, plus the tiny
// pure helpers CLAUDE.md rule 1 allows — no `applyCommand`/`resolveTurn` behavior here; those
// are implemented against these types in later tasks (06 commands, 07 resolution).
//
// All state is plain JSON-serializable data (no classes, Maps, or functions) per TR §4, so it
// can be saved, diffed, and installed by the test handle (TR §14).

import type { Cell, Col, Lane } from './coords';
import type { RngState } from './rng';

// --- Tiles (GDD §9) ---

export type TileKind = 'add' | 'sub' | 'mul';

/** Drives shop price (GDD §8.4): `add`/`sub` tiles, `×2`–`×5` (`mulLow`), `×6`–`×10` (`mulHigh`). */
export type PriceCategory = 'add' | 'sub' | 'mulLow' | 'mulHigh';

export type TileId = `${TileKind}:${number}`;

export interface TileDef {
  id: TileId;
  kind: TileKind;
  n: number;
  priceCategory: PriceCategory;
}

/** One physical owned tile (GDD §9.2) — owning one `+5` means one `+5` on the board or tray. */
export interface TilePiece {
  pieceId: string;
  tileId: TileId;
}

// --- Robots and traits (GDD §6) ---

export type Trait =
  | { type: 'none' }
  | { type: 'weakness'; n: 2 | 5 | 10 }
  | { type: 'bounceBack' }
  | { type: 'oddOnly' }
  | { type: 'evenOnly' };

export interface Robot {
  robotId: string;
  lane: Lane;
  /** `null` = waiting off-board (spawn cell was occupied, GDD §4 step 1). */
  col: Col | null;
  hp: number;
  maxHp: number;
  trait: Trait;
  isBoss: boolean;
}

// --- Board (GDD §3) ---

export interface Board {
  /** length 5, index = lane. */
  cannons: boolean[];
  /** `[lane][col]` -> pieceId occupying that cell, or null. Col 0 is always null (GDD §3.4). */
  cells: (string | null)[][];
  /** On-board and waiting (off-board) robots. */
  robots: Robot[];
}

export type Phase = 'planning' | 'waveCleared' | 'shop' | 'won' | 'lost' | 'levelCleared';

/** Easy / Normal / Hard (GDD §10.7). Independent of `RunState.mode` (run vs puzzle). */
export type DifficultyId = 'easy' | 'normal' | 'hard';

/** One concrete entry of a wave's spawn schedule (GDD §10.3), rolled at wave start by
 * `rollWave`: lane letters are already resolved and the HP range already rolled. */
export interface SpawnEntry {
  /** 1-based turn within the wave. */
  turn: number;
  lane: Lane;
  /** A `robots.json` id. */
  robotTemplateId: string;
  /** The spawned robot's HP and `maxHp`. */
  hp: number;
}

/** Identifies one shop offer slot (GDD §8.3: 3 tile offers, 1 cannon offer, 1 upgrade offer). */
export type ShopSlotId = `tile:${number}` | 'cannon' | 'upgrade';

/** One shop card. `price` is fixed at roll time (TR §4). */
export type ShopOffer =
  | { slot: `tile:${number}`; kind: 'tile'; tileId: TileId; price: number; bought: boolean }
  | { slot: 'cannon'; kind: 'cannon'; price: number; bought: boolean; available: boolean }
  | {
      slot: 'upgrade';
      kind: 'upgrade';
      price: number;
      bought: boolean;
      fromValue: number;
      toValue: number;
    };

/** Active shop offers for the current shop visit. */
export interface ShopState {
  /** 1-based: the wave just cleared (`= waveIndex + 1`), keyed to `shop.json`. */
  afterWave: number;
  /** Tile slots in order, then `'cannon'`, then `'upgrade'`. */
  offers: ShopOffer[];
}

/** Snapshot pushed onto `RunState.undo` by planning commands (TR §5): board cells, tray, and
 * cannons — the only things a planning command can change. Cleared on `endTurn`. */
export interface PlanningSnapshot {
  cells: (string | null)[][];
  tray: string[];
  cannons: boolean[];
}

export interface RunState {
  schemaVersion: number;
  /** `'level'` = M1 hand-authored puzzles (TR §4.1). */
  mode: 'run' | 'level';
  /** Locked at `newRun`. Level-mode states store `'normal'` (puzzles ignore it). */
  difficulty: DifficultyId;
  levelId?: string;
  seed: string;
  rng: { wave: RngState; shop: RngState };
  phase: Phase;
  /** 0-based. */
  waveIndex: number;
  /** 1-based within the wave. */
  turn: number;
  baseHp: number;
  coins: number;
  cannonBaseValue: number;
  upgradesBought: number;
  /** Exact kills over the whole run, shown on the win and lose screens (GDD §10.6). */
  exactKills: number;
  /** All owned tiles, keyed by `pieceId`. */
  pieces: Record<string, TilePiece>;
  /** `pieceId`s not on the board, in display order. */
  tray: string[];
  board: Board;
  /** Remaining spawn schedule for this wave. */
  pendingSpawns: SpawnEntry[];
  /** Cleared on `endTurn`. */
  undo: PlanningSnapshot[];
  /** Events from the last resolved turn, for Replay (GDD §4.3, §12.2). */
  lastTurnEvents: GameEvent[];
  shop: ShopState | null;
  nextIds: { robot: number; piece: number; ball: number };
}

// --- Events (TR §7) ---

export interface EventBase {
  /** Strictly increasing within one resolution, starting at 0. */
  step: number;
  /** Playback/concurrency group, e.g. `"fire:lane:2"`, `"advance"`, `"detonate:3"`, `"spawn"`,
   * `"end"`. Events sharing a group belong to one playback segment. No durations in events —
   * pacing lives in `presentation.json` (TR §9). */
  group: string;
}

export type GameEvent = EventBase &
  (
    | { type: 'LaneStarted'; lane: Lane }
    | { type: 'BallFired'; ballId: string; lane: Lane; at: Cell; value: number }
    | { type: 'BallMoved'; ballId: string; lane: Lane; from: Cell; to: Cell }
    | {
        type: 'BallTransformed';
        ballId: string;
        at: Cell;
        tileId: TileId;
        pieceId: string;
        oldValue: number;
        newValue: number;
        chainDepth: number;
      }
    | { type: 'BallExited'; ballId: string; lane: Lane; at: Cell }
    | {
        type: 'BallBlocked';
        ballId: string;
        robotId: string;
        at: Cell;
        value: number;
        reason: 'oddOnly' | 'evenOnly';
      }
    | {
        type: 'RobotDamaged';
        robotId: string;
        ballId: string;
        at: Cell;
        ballValue: number;
        damage: number;
        doubled: boolean;
        hpBefore: number;
        hpAfter: number;
      }
    | {
        type: 'RobotBouncedBack';
        robotId: string;
        at: Cell;
        hpBefore: number;
        hpAfter: number;
        overshoot: number;
      }
    | { type: 'RobotDefeated'; robotId: string; at: Cell; exact: boolean }
    | {
        type: 'CoinsChanged';
        delta: number;
        total: number;
        reason: 'kill' | 'exactKill' | 'waveCleared' | 'purchase';
      }
    | { type: 'LaneEnded'; lane: Lane }
    | { type: 'RobotAdvanced'; robotId: string; from: Cell; to: Cell }
    | { type: 'RobotDetonated'; robotId: string; lane: Lane; damage: number }
    | { type: 'BaseDamaged'; amount: number; hpBefore: number; hpAfter: number }
    | {
        type: 'RobotSpawned';
        robotId: string;
        at: Cell;
        hp: number;
        maxHp: number;
        trait: Trait;
        isBoss: boolean;
      }
    | { type: 'RobotWaiting'; robotId: string; lane: Lane; hp: number; maxHp: number; trait: Trait }
    | { type: 'WaveCleared'; waveIndex: number }
    /** Tiles entered the tray — shop purchases (M2 used this for wave rewards). */
    | { type: 'TilesGranted'; tiles: { pieceId: string; tileId: TileId }[] }
    | { type: 'OfferBought'; slot: ShopSlotId; kind: 'tile' | 'cannon' | 'upgrade'; price: number }
    | { type: 'CannonPlaced'; lane: Lane }
    | { type: 'BaseValueChanged'; from: number; to: number }
    | { type: 'LevelCleared'; levelId: string }
    | { type: 'RunWon' }
    | { type: 'RunLost' }
  );

// --- Commands (TR §5) ---

export type Command =
  | { type: 'placeTile'; pieceId: string; to: Cell }
  | { type: 'moveTile'; from: Cell; to: Cell }
  | { type: 'returnTile'; from: Cell }
  | { type: 'moveCannon'; fromLane: Lane; toLane: Lane }
  | { type: 'undo' }
  | { type: 'endTurn' }
  | { type: 'openShop' }
  | { type: 'buyOffer'; slot: ShopSlotId }
  | { type: 'nextWave' }
  | { type: 'newRun'; seed: string; difficulty?: DifficultyId }
  | { type: 'loadLevel'; levelId: string };

export type CommandError =
  | 'wrong_phase'
  | 'cell_locked'
  | 'cell_occupied'
  | 'not_a_tile_cell'
  | 'no_tile_here'
  | 'piece_not_in_tray'
  | 'slot_occupied'
  | 'no_cannon_here'
  | 'nothing_to_undo'
  | 'insufficient_coins'
  | 'offer_unavailable';

// `applyCommand(state, cmd, data): { ok: true; state; events } | { ok: false; error }` (TR §5)
// is implemented in task 06 against `GameData` (`/sim/data/schemas.ts`) and the types above.
