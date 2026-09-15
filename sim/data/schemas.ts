// Zod schemas for /data/*.json (GDD §13, TR §9). Validated once at load time by
// `parseGameData` (`./load.ts`), which throws a readable `<file>.json: <path>: <message>`
// error on the first failure — so a broken data file is a loud, precise failure, not a
// mysterious runtime bug three layers away.
//
// `robots.json`, `shop.json`, `waves.json` are not needed until M3/M4 — their schemas accept
// only the minimal placeholder shape shipped in `/data` today, marked below. Expanding them is
// the job of the milestone that adds their real content, not this task.

import { z } from 'zod';
import { COLS, LANES } from '../core/coords';
import type { Col, Lane } from '../core/coords';
import type { TileId } from '../core/types';

// --- tiles.json (GDD §9.1, all milestones) ---

const TileKindSchema = z.enum(['add', 'sub', 'mul']);

/** Drives shop price (GDD §8.4). */
const PriceCategorySchema = z.enum(['add', 'sub', 'mulLow', 'mulHigh']);

/** GDD §9.1 color key (`+` green, `−` blue, `×` orange); `×6`+ is additionally "starred" in
 * presentation. Recorded as a plain boolean here rather than a fourth color, per task 04
 * Deviations — the starred glyph is a presentation detail layered on the orange base color,
 * not a distinct category. */
const TileColorSchema = z.enum(['green', 'blue', 'orange']);

const TileDefSchema = z
  .object({
    id: z.string(),
    kind: TileKindSchema,
    n: z.number().int(),
    priceCategory: PriceCategorySchema,
    color: TileColorSchema,
    starred: z.boolean(),
  })
  .superRefine((tile, ctx) => {
    if (tile.id !== `${tile.kind}:${tile.n}`) {
      ctx.addIssue({
        code: 'custom',
        path: ['id'],
        message: `id must be "${tile.kind}:${tile.n}", got "${tile.id}"`,
      });
    }
    if (tile.kind === 'add' || tile.kind === 'sub') {
      if (tile.n < 1 || tile.n > 10) {
        ctx.addIssue({ code: 'custom', path: ['n'], message: `${tile.kind} n must be 1-10` });
      }
      if (tile.priceCategory !== tile.kind) {
        ctx.addIssue({
          code: 'custom',
          path: ['priceCategory'],
          message: `priceCategory must be "${tile.kind}" for ${tile.kind} tiles`,
        });
      }
    } else {
      if (tile.n < 2 || tile.n > 10) {
        ctx.addIssue({ code: 'custom', path: ['n'], message: 'mul n must be 2-10' });
      }
      const expectedCategory = tile.n <= 5 ? 'mulLow' : 'mulHigh';
      if (tile.priceCategory !== expectedCategory) {
        ctx.addIssue({
          code: 'custom',
          path: ['priceCategory'],
          message: `priceCategory must be "${expectedCategory}" for ×${tile.n}`,
        });
      }
    }
  })
  // The superRefine above already rejects any tile whose `id` isn't exactly `${kind}:${n}`, so
  // by the time this transform runs on a successful parse the `TileId` template-literal shape
  // is guaranteed — narrow the inferred type here instead of leaving callers with a bare
  // `string` that fails to satisfy `TileDef` (TR §4) at every call site (e.g. `applyTile`).
  .transform((tile) => ({ ...tile, id: tile.id as TileId }));

const TilesFileSchema = z
  .array(TileDefSchema)
  .min(1)
  .superRefine((tiles, ctx) => {
    const seen = new Set<string>();
    tiles.forEach((tile, index) => {
      if (seen.has(tile.id)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: `duplicate tile id "${tile.id}"`,
        });
      }
      seen.add(tile.id);
    });
  });

// --- economy.json (GDD §7.1, §8.1-8.2, §10.1) ---

const EconomyFileSchema = z.object({
  schemaVersion: z.number().int().min(1),
  baseHp: z.number().int().positive(),
  startCoins: z.number().int().nonnegative(),
  startCannonLane: z
    .number()
    .int()
    .min(0)
    .max(LANES - 1),
  startBaseValue: z.number().int(),
  maxCannons: z.number().int().min(1).max(LANES),
  income: z.object({
    kill: z.number().int().nonnegative(),
    exactKill: z.number().int().nonnegative(),
    waveCleared: z.number().int().nonnegative(),
  }),
});

// --- presentation.json (GDD §12.2, TR §9) ---

const ms = () => z.number().nonnegative();
const scale = () => z.number().positive();
/** Camera shake intensity, as a fraction of the camera size (Phaser `Camera.shake`). */
const shakeIntensity = () => z.number().min(0).max(0.05);
const share = () => z.number().min(0).max(1);

const PresentationFileSchema = z.object({
  pacing: z.object({
    ballCellDurationMs: z.number().positive(),
    /** Per-cell travel for a lane whose ball exits without hitting a robot (task 10 req. 2). */
    exitBallCellDurationMs: z.number().positive(),
    perTilePauseMs: z.number().nonnegative(),
    laneGapMs: z.number().nonnegative(),
    advanceDurationMs: z.number().positive(),
  }),
  /** Playback Director beats (task 10, GDD §12.2). Presentation only — never changes an outcome.
   * Each `*Ms` is the time that beat holds the sequence before the next event plays. */
  playback: z.object({
    beats: z.object({
      laneStartMs: ms(),
      ballFireMs: ms(),
      impactMs: ms(),
      blockedMs: ms(),
      bounceBackMs: ms(),
      defeatMs: ms(),
      exactKillMs: ms(),
      coinsMs: ms(),
      exitMs: ms(),
      laneEndMs: ms(),
    }),
    /** Fractions of a beat's duration given to its sub-animations (e.g. the damage number fades
     * for the last `fade` of the impact beat, after `most` of it has passed). */
    beatShares: z.object({
      quick: share(),
      grow: share(),
      half: share(),
      most: share(),
      fade: share(),
    }),
    lane: z.object({
      /** Alpha of the dark wash over inactive lanes. */
      dimAlpha: z.number().min(0).max(1),
    }),
    cannon: z.object({ thumpScale: scale() }),
    ball: z.object({
      /** The ball grows in from this scale when fired. */
      fireFromScale: scale(),
    }),
    transform: z.object({
      /** Ball scale pop on the first tile; each further tile in the chain adds `popScalePerChain`,
       * up to `popScaleMax` (escalation, GDD §12.2). */
      popScale: scale(),
      popScalePerChain: z.number().nonnegative(),
      popScaleMax: scale(),
      tilePopScale: scale(),
      tileFlashAlpha: z.number().min(0).max(1),
      /** The ball hops up this far onto a tile it is about to apply (and the tile draws above it for
       * the beat), so the tile's label stays readable. */
      ballHopPt: z.number().nonnegative(),
    }),
    impact: z.object({
      knockbackPt: z.number().nonnegative(),
      damageFloatPt: z.number().nonnegative(),
      /** Scale of the flying damage number when Weakness doubled the damage. */
      doubledDamageScale: scale(),
      shakeMs: ms(),
      shakePerDamage: z.number().nonnegative(),
      shakeMax: shakeIntensity(),
    }),
    blocked: z.object({
      bounceOffPt: z.number().nonnegative(),
      robotWobblePt: z.number().nonnegative(),
      /** Extra side-to-side shakes of the robot after the first. */
      robotWobbleRepeats: z.number().int().nonnegative(),
      shakeMs: ms(),
      shake: shakeIntensity(),
    }),
    bounceBack: z.object({
      wobbleScale: scale(),
      /** How far past full the springy HP bar refill may overshoot before settling (1 = none). */
      maxBarFill: z.number().min(1),
    }),
    defeat: z.object({ popScale: scale(), puffScale: scale() }),
    exactKill: z.object({
      popScale: scale(),
      starCount: z.number().int().nonnegative(),
      starBurstPt: z.number().nonnegative(),
      starSpinDeg: z.number(),
      bigStarSpinDeg: z.number(),
      bigStarScale: scale(),
      ringScale: scale(),
      shakeMs: ms(),
      shake: shakeIntensity(),
    }),
    coins: z.object({ floatPt: z.number().nonnegative() }),
    exit: z.object({ rollPt: z.number().nonnegative(), rollSpinDeg: z.number() }),
  }),
  tileColors: z.record(TileColorSchema, z.string().min(1)),
  /** Board drag-and-drop feel (task 09). Presentation only — never changes an outcome. */
  drag: z.object({
    /** Scale of a lifted piece relative to its on-board size. */
    liftScale: z.number().min(1),
    liftDurationMs: z.number().nonnegative(),
    /** How far above the finger (design points) a dragged piece is held, so it isn't hidden. */
    fingerOffsetPt: z.number().nonnegative(),
    /** Snap radius in cells, measured per axis from a cell's centre (task 09: ≥ 0.6 cell). */
    snapRadiusCells: z.number().min(0.6),
    /** Tween back to a piece's home (after a drop, an invalid drop, or an undo). */
    settleDurationMs: z.number().nonnegative(),
    /** Movement (design points) before a press on an overflowing tray decides drag vs scroll. */
    trayScrollThresholdPt: z.number().positive(),
  }),
});

// --- robots.json — expanded in M3/M4 (robot templates, traits, visual keys) ---

const RobotsFileSchema = z.array(z.unknown());

// --- shop.json — expanded in M3 (price table, cannon/upgrade formulas, offer tables, ladder) ---

const ShopFileSchema = z.object({}).passthrough();

// --- waves.json — expanded in M2 (spawn schedules, procedural tables) ---

const WavesFileSchema = z.object({ waves: z.array(z.unknown()) });

// --- levels.json — expanded in task 06 (hand-authored puzzle levels, M1) ---

/** References an existing tile definition by id (e.g. `"add:5"`) — used by a level's
 * pre-placed board tiles and tray, not a full `TileDefSchema` (a level names tiles, it doesn't
 * redefine them). Same narrowing rationale as `TileDefSchema`'s `.transform` above. */
const TileIdRefSchema = z
  .string()
  .regex(/^(add|sub|mul):\d+$/, 'must be a tile id like "add:5"')
  .transform((id) => id as TileId);

/** Narrows a validated lane/col number to its branded `Lane`/`Col` type (TR §3), the same way
 * `TileDefSchema` narrows `id` to `TileId` — callers get `Lane`/`Col` directly instead of a bare
 * `number` that fails to satisfy `Robot`/`Board` at every call site. */
const LaneSchema = z
  .number()
  .int()
  .min(0)
  .max(LANES - 1)
  .transform((lane) => lane as Lane);

/** Column 1..COLS-1 — a level's tiles and robots only ever occupy tile-cell columns (GDD §3.1);
 * column 0 is the cannon slot. */
const TileColSchema = z
  .number()
  .int()
  .min(1)
  .max(COLS - 1)
  .transform((col) => col as Col);

/** Mirrors `Trait` (`sim/core/types.ts`) exactly — task 08's scenario runner reuses this same
 * shape for scenario robots. */
const TraitSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({
    type: z.literal('weakness'),
    n: z.union([z.literal(2), z.literal(5), z.literal(10)]),
  }),
  z.object({ type: z.literal('bounceBack') }),
  z.object({ type: z.literal('oddOnly') }),
  z.object({ type: z.literal('evenOnly') }),
]);

const LevelTilePlacementSchema = z.object({
  lane: LaneSchema,
  col: TileColSchema,
  tileId: TileIdRefSchema,
});

/** Robot trait defaults to `{ type: 'none' }` (task 06 ruling) — v1 levels are stationary
 * puzzles with no traits in play (traits arrive in M4), but the field exists now so task 08's
 * scenario files (which do exercise traits) can reuse this same schema shape. */
const LevelRobotSchema = z.object({
  lane: LaneSchema,
  col: TileColSchema,
  hp: z.number().int().positive(),
  trait: TraitSchema.default({ type: 'none' }),
});

const LevelDefSchema = z
  .object({
    id: z.string().min(1),
    /** Lanes with a cannon at load time (GDD §9.4); at most one entry per lane. */
    cannonLanes: z.array(LaneSchema),
    /** The level's cannon base value (TR §4: `RunState.cannonBaseValue`). */
    baseValue: z.number().int(),
    boardTiles: z.array(LevelTilePlacementSchema).default([]),
    /** Tray tile ids, in display order; each becomes one owned `TilePiece` (GDD §9.2). */
    tray: z.array(TileIdRefSchema).default([]),
    robots: z.array(LevelRobotSchema),
  })
  .superRefine((level, ctx) => {
    const seenLanes = new Set<Lane>();
    level.cannonLanes.forEach((lane, index) => {
      if (seenLanes.has(lane)) {
        ctx.addIssue({
          code: 'custom',
          path: ['cannonLanes', index],
          message: `duplicate cannon lane ${lane}`,
        });
      }
      seenLanes.add(lane);
    });

    const seenCells = new Set<string>();
    level.boardTiles.forEach((placement, index) => {
      const key = `${placement.lane},${placement.col}`;
      if (seenCells.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['boardTiles', index],
          message: `duplicate tile placement at lane ${placement.lane} col ${placement.col}`,
        });
      }
      seenCells.add(key);
    });
  });

const LevelsFileSchema = z.object({
  levels: z.array(LevelDefSchema).superRefine((levels, ctx) => {
    const seen = new Set<string>();
    levels.forEach((level, index) => {
      if (seen.has(level.id)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: `duplicate level id "${level.id}"`,
        });
      }
      seen.add(level.id);
    });
  }),
});

/** One hand-authored M1 puzzle level (TR §4.1). Consumed by `buildLevelState`
 * (`sim/commands/level.ts`) and, from task 08, by the scenario runner. */
export type LevelDef = z.infer<typeof LevelDefSchema>;

// --- Combined ---

export const GameDataSchema = z.object({
  tiles: TilesFileSchema,
  robots: RobotsFileSchema,
  economy: EconomyFileSchema,
  shop: ShopFileSchema,
  waves: WavesFileSchema,
  levels: LevelsFileSchema,
  presentation: PresentationFileSchema,
});

/** The validated shape of everything in `/data`, combined. `applyCommand` (TR §5, task 06) and
 * `resolveTurn` (TR §6, task 07) both take a `GameData` alongside `RunState`. */
export type GameData = z.infer<typeof GameDataSchema>;
