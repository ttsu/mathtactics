// Zod schemas for /data/*.json (GDD §13, TR §9). Validated once at load time by
// `parseGameData` (`./load.ts`), which throws a readable `<file>.json: <path>: <message>`
// error on the first failure — so a broken data file is a loud, precise failure, not a
// mysterious runtime bug three layers away.
//
// `shop.json` is not needed until M3 — its schema accepts only the minimal placeholder shape
// shipped in `/data` today, marked below. Expanding it is the job of the milestone that adds its
// real content.

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

/** How hard a ball passing through one kind of tile is emphasised (presentation only). */
const TransformStrengthSchema = z.object({
  /** Added to the chain's ball pop scale. */
  popBonus: z.number().nonnegative(),
  /** The ball covers the tile as it rolls through, so a copy of the tile's label floats up this
   * far above the ball's centre (clear of the popped ball) to keep the operation readable. */
  labelFloatPt: z.number().nonnegative(),
  /** Peak scale of the floating operator label. */
  labelScale: scale(),
  /** Rings in the tile's colour bursting out from the ball, and how far each grows (× ball size). */
  ringCount: z.number().int().nonnegative(),
  ringScale: scale(),
  /** Sparks flying out from the ball, and how far they fly. */
  sparkCount: z.number().int().nonnegative(),
  sparkBurstPt: z.number().nonnegative(),
  /** The ball rocks this far either way while it pops (0 = no rock). */
  wobbleDeg: z.number().nonnegative(),
  shakeMs: ms(),
  shake: shakeIntensity(),
});

const PresentationFileSchema = z.object({
  pacing: z.object({
    ballCellDurationMs: z.number().positive(),
    /** Per-cell travel for a lane whose ball exits without hitting a robot (task 10 req. 2). */
    exitBallCellDurationMs: z.number().positive(),
    perTilePauseMs: z.number().nonnegative(),
    /** The hold on a `×N` tile — longer than `perTilePauseMs` so its stronger effect lands. */
    multiplyTilePauseMs: z.number().nonnegative(),
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
       * up to `popScaleMax` (escalation, GDD §12.2). A tile kind's `popBonus` is added on top. */
      popScale: scale(),
      popScalePerChain: z.number().nonnegative(),
      popScaleMax: scale(),
      tilePopScale: scale(),
      tileFlashAlpha: z.number().min(0).max(1),
      /** How long the pass effect (operator label, rings, sparks) plays. It may outlast the tile's
       * pause — the ball rolls on while it fades. */
      effectMs: ms(),
      /** Pass effect for `+N` / `−N` tiles, and a stronger one for `×N` tiles. */
      additive: TransformStrengthSchema,
      multiply: TransformStrengthSchema,
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
  /** React screens and overlays (task 11: main menu, level cleared, all done). Presentation only. */
  screens: z.object({
    /** How long a screen's celebration art and big button take to pop in. */
    popInMs: ms(),
  }),
});

// --- shop.json — expanded in M3 (price table, cannon/upgrade formulas, offer tables, ladder) ---

const ShopFileSchema = z.object({}).passthrough();

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

// --- robots.json (GDD §6.1, TR §9) — M2 ships one template, `basic`; visual keys arrive in M5 ---

const RobotTemplateSchema = z.strictObject({
  id: z.string().min(1),
  trait: TraitSchema,
  isBoss: z.boolean(),
});

const RobotsFileSchema = z.array(RobotTemplateSchema).superRefine((robots, ctx) => {
  const seen = new Set<string>();
  robots.forEach((robot, index) => {
    if (seen.has(robot.id)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'id'],
        message: `duplicate robot id "${robot.id}"`,
      });
    }
    seen.add(robot.id);
  });
});

/** A `robots.json` entry: the trait and Boss flag every robot spawned from it gets. */
export type RobotTemplate = z.infer<typeof RobotTemplateSchema>;

// --- waves.json (GDD §10.3, §10.5, TR §9) — authored waves; procedural tables arrive in M4 ---

export const LANE_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
export type LaneLetter = (typeof LANE_LETTERS)[number];

/** Highest HP an authored spawn may roll: normal robot HP never exceeds 99 (GDD §2.1). The Boss
 * (M4) is the only three-digit robot and will need its own limit. */
const MAX_SPAWN_HP = 99;

const SpawnHpSchema = z.number().int().min(1).max(MAX_SPAWN_HP);

const WaveSpawnSchema = z.strictObject({
  /** 1-based turn within the wave. */
  turn: z.number().int().min(1),
  /** A fixed lane, or a letter rolled to a seeded-random lane at wave start (GDD §10.3). */
  lane: z.union([LaneSchema, z.enum(LANE_LETTERS)], {
    error: 'lane must be 0-4 or a letter A-E',
  }),
  /** A `robots.json` id (checked across files in `GameDataSchema`). */
  robot: z.string().min(1),
  /** `[min, max]`, both inclusive; rolled at wave start. */
  hp: z.tuple([SpawnHpSchema, SpawnHpSchema]).superRefine(([min, max], ctx) => {
    if (min > max) {
      ctx.addIssue({ code: 'custom', message: `hp min ${min} is greater than max ${max}` });
    }
  }),
});

const WaveDefSchema = z
  .strictObject({
    id: z.string().min(1),
    spawns: z.array(WaveSpawnSchema).min(1),
    /** M2 stand-in for the shop (GDD §10.5): tiles appended to the tray when this wave clears. */
    reward: z.strictObject({ tiles: z.array(TileIdRefSchema) }).optional(),
  })
  .superRefine((wave, ctx) => {
    if (!wave.spawns.some((spawn) => spawn.turn === 1)) {
      ctx.addIssue({
        code: 'custom',
        path: ['spawns'],
        message: 'a wave needs a spawn on turn 1',
      });
    }

    const fixedLanes = new Set<number>();
    const letters = new Set<string>();
    for (const spawn of wave.spawns) {
      if (typeof spawn.lane === 'number') fixedLanes.add(spawn.lane);
      else letters.add(spawn.lane);
    }
    const freeLanes = LANES - fixedLanes.size;
    if (letters.size > freeLanes) {
      ctx.addIssue({
        code: 'custom',
        path: ['spawns'],
        message: `${letters.size} lane letters but only ${freeLanes} lanes are not fixed`,
      });
    }
  });

/** One authored wave from `waves.json`. Rolled into concrete `SpawnEntry`s by `rollWave`. */
export type WaveDef = z.infer<typeof WaveDefSchema>;

const WavesFileSchema = z.strictObject({
  waves: z
    .array(WaveDefSchema)
    .min(1)
    .superRefine((waves, ctx) => {
      const seen = new Set<string>();
      waves.forEach((wave, index) => {
        if (seen.has(wave.id)) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'id'],
            message: `duplicate wave id "${wave.id}"`,
          });
        }
        seen.add(wave.id);
      });
      const lastIndex = waves.length - 1;
      if (waves[lastIndex]?.reward !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [lastIndex, 'reward'],
          message: 'the last wave cannot have a reward (the run is won)',
        });
      }
    }),
});

// --- Combined ---

export const GameDataSchema = z
  .object({
    tiles: TilesFileSchema,
    robots: RobotsFileSchema,
    economy: EconomyFileSchema,
    shop: ShopFileSchema,
    waves: WavesFileSchema,
    levels: LevelsFileSchema,
    presentation: PresentationFileSchema,
  })
  // Cross-file references: checked here, once every file has parsed on its own. Issue paths
  // start with the file key, so `parseGameData` reports them as `waves.json: waves[0]...`.
  .superRefine((data, ctx) => {
    const robotIds = new Set(data.robots.map((robot) => robot.id));
    const tileIds = new Set<string>(data.tiles.map((tile) => tile.id));
    data.waves.waves.forEach((wave, waveIndex) => {
      wave.spawns.forEach((spawn, spawnIndex) => {
        if (!robotIds.has(spawn.robot)) {
          ctx.addIssue({
            code: 'custom',
            path: ['waves', 'waves', waveIndex, 'spawns', spawnIndex, 'robot'],
            message: `unknown robot id "${spawn.robot}"`,
          });
        }
      });
      wave.reward?.tiles.forEach((tileId, tileIndex) => {
        if (!tileIds.has(tileId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['waves', 'waves', waveIndex, 'reward', 'tiles', tileIndex],
            message: `unknown tile id "${tileId}"`,
          });
        }
      });
    });
  });

/** The validated shape of everything in `/data`, combined. `applyCommand` (TR §5, task 06) and
 * `resolveTurn` (TR §6, task 07) both take a `GameData` alongside `RunState`. */
export type GameData = z.infer<typeof GameDataSchema>;
