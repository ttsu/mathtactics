// Zod schemas for /data/*.json (GDD §13, TR §9). Validated once at load time by
// `parseGameData` (`./load.ts`), which throws a readable `<file>.json: <path>: <message>`
// error on the first failure — so a broken data file is a loud, precise failure, not a
// mysterious runtime bug three layers away.
//
// `shop.json` (M3, task 18): prices, cannon/upgrade formulas, per-wave tables, ladder guarantees.

import { z } from 'zod';
import { COLS, LANES, isLane } from '../core/coords';
import type { Col, Lane } from '../core/coords';
import { reservedSpawnLanes } from '../core/footprint';
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

const TilePopKindSchema = z
  .object({
    baseHz: z.number().positive(),
    offsetSemitones: z.number(),
  })
  .strict();

/** Foley (`@foleyjs/core`) cue ids. Every locked game cue maps to one of these. */
const FoleyCueIdSchema = z.enum([
  'tick',
  'hover',
  'glide',
  'pop',
  'press',
  'release',
  'tap',
  'thock',
  'on',
  'off',
  'switch',
  'latch',
  'success',
  'error',
  'warning',
  'denied',
  'chime',
  'ping',
  'bell',
  'bubble',
  'swoosh',
  'whoosh',
  'drop',
  'rise',
  'loading',
  'ready',
  'complete',
  'sparkle',
]);

const FoleyPlaySchema = z
  .object({
    name: FoleyCueIdSchema,
    /** Extra transpose for this play only, in semitones. */
    pitch: z.number().optional(),
    /** Level multiplier for this play only, 0–1. */
    volume: z.number().min(0).max(1).optional(),
    /** Overrides the global Foley theme for this cue only (e.g. a glass-theme tile pop). */
    theme: z.enum(['default', 'soft', 'mechanical', 'glass']).optional(),
  })
  .strict();

const FoleySettingsSchema = z
  .object({
    theme: z.enum(['default', 'soft', 'mechanical', 'glass']),
    volume: z.number().min(0).max(1),
    /** Foley reverb send (0–1). Keep small — GDD §12.4 forbids long reverb. */
    space: z.number().min(0).max(1),
    cues: z
      .object({
        uiTap: FoleyPlaySchema,
        preview: FoleyPlaySchema,
        pickupTile: FoleyPlaySchema,
        pickupCannon: FoleyPlaySchema,
        dropTile: FoleyPlaySchema,
        dropCannon: FoleyPlaySchema,
        snapBack: FoleyPlaySchema,
        trayTick: FoleyPlaySchema,
        cannonThump: FoleyPlaySchema,
        tilePop: FoleyPlaySchema,
        impact: FoleyPlaySchema,
        kill: FoleyPlaySchema,
        exactKill: FoleyPlaySchema,
        bounceBack: FoleyPlaySchema,
        clonk: FoleyPlaySchema,
        detonate: FoleyPlaySchema,
        spawn: FoleyPlaySchema,
        buy: FoleyPlaySchema,
        nope: FoleyPlaySchema,
        waveCleared: FoleyPlaySchema,
        win: FoleyPlaySchema,
        lose: FoleyPlaySchema,
      })
      .strict(),
  })
  .strict();

const AudioSettingsSchema = z
  .object({
    maxVoices: z.number().int().positive(),
    /** Multiplies `impact` Foley volume when `RobotDamaged.doubled`. */
    impactDoubledGain: z.number().positive(),
    tilePop: z
      .object({
        depthRatio: z.number().positive(),
        add: TilePopKindSchema,
        sub: TilePopKindSchema,
        mul: TilePopKindSchema,
      })
      .strict(),
    /** Every locked cue name plays through Foley `play()`. */
    foley: FoleySettingsSchema,
  })
  .strict();

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
      /** A queued robot's flash+shake+HP-fly-out beat, in its own `detonate:<lane>` segment
       * (task 15, GDD §12.2 step 5). */
      detonateMs: ms(),
      /** How long the HUD base HP takes to count from `hpBefore` to `max(0, hpAfter)`, right
       * after the `detonateMs` beat (task 15 req. 3). */
      baseCountDownMs: ms(),
      /** A `RobotSpawned`/`RobotWaiting` beat — drop into column 7, or pop in as a ghost
       * (task 15, GDD §12.2 step 6). */
      spawnMs: ms(),
      /** Trailing pause on a run-mode `"end"` segment (wave cleared / won / lost) — no board beat
       * of its own, just a short hold before playback finishes (task 15 req. 5). */
      endMs: ms(),
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
      /** Side-to-side travel of the parity shield on a clonk — the robot body stays still. */
      shieldWobblePt: z.number().nonnegative(),
      /** Extra side-to-side shakes of the shield after the first. */
      shieldWobbleRepeats: z.number().int().nonnegative(),
      shakeMs: ms(),
      shake: shakeIntensity(),
    }),
    bounceBack: z.object({
      wobbleScale: scale(),
      /** How far past full the springy HP bar refill may overshoot before settling (1 = none). */
      maxBarFill: z.number().min(1),
      /** How far right of the robot's right edge the remainder numeral lands. */
      remainderLandPt: z.number().nonnegative(),
      remainderPopScale: scale(),
      /** Tiny green pluses that fade up as the remainder is sucked in (GDD §6.2). */
      plusCount: z.number().int().nonnegative(),
      plusFloatPt: z.number().nonnegative(),
      plusSpreadPt: z.number().nonnegative(),
      plusColor: z.string().min(1),
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
    /** A detonation's flash/shake and its HP-to-HUD flying number (task 15, GDD §12.2 step 5). */
    detonate: z.object({
      shakeMs: ms(),
      shake: shakeIntensity(),
      /** Design-point target the robot's flying HP number tweens toward — approximately the
       * HUD's ♥ (Phaser can't target the React DOM element itself, TR §11.1). */
      heartTargetX: z.number(),
      heartTargetY: z.number(),
      /** Scale the flying number shrinks to as it nears the HUD. */
      heartLabelScale: scale(),
    }),
    /** A robot entering the board, solid or as a waiting ghost (task 15, GDD §12.2 step 6). */
    spawn: z.object({
      /** How far above column 7 a newly spawned robot drops in from. */
      dropFromPt: z.number().nonnegative(),
      dropFromScale: scale(),
      /** Alpha of a waiting robot's ghost, just right of column 7. */
      ghostAlpha: z.number().min(0).max(1),
      /** Scale a ghost pops in from when it first appears. */
      ghostPopFromScale: scale(),
    }),
  }),
  tileColors: z.record(TileColorSchema, z.string().min(1)),
  /** Planning-phase trait telegraph colours (task 23, GDD §6.2–6.4). Keys are locked;
   * hex values may be tuned for HP contrast. */
  traits: z.object({
    weaknessNColor: z.string().min(1),
    weaknessMarkColor: z.string().min(1),
    oddShieldColor: z.string().min(1),
    evenShieldColor: z.string().min(1),
    bounceBackBodyColor: z.string().min(1),
  }),
  /** Wave-10 Boss visual scale on top of the 2×2 layout size (GDD §6.6). `1` fills the 2×2
   * with the same outer margin as a 1×1. Applied to the silhouette inside `RobotView.setChrome`,
   * never to the Container (playback resets Container scale to 1). */
  boss: z.object({
    scale: scale(),
  }),
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
  /** React screens and overlays (task 11: main menu, level cleared, all done; task 16: wave
   * cleared, win, lose). Presentation only. */
  screens: z.object({
    /** How long a screen's celebration art and big button take to pop in. */
    popInMs: ms(),
    /** Delay between each wave-cleared wallet bonus pop-in (task 16; reused in task 19). */
    rewardStaggerMs: ms(),
    /** Delay between each of the 5 shop cards popping in (task 20). */
    shopCardStaggerMs: ms(),
    /** Bought-card pop (task 20). */
    shopPurchasePopMs: ms(),
    /** Shop wallet numeral counting down to the new total (task 20). */
    shopWalletCountMs: ms(),
    /** Unaffordable-card shake (task 20). */
    shopRefusalShakeMs: ms(),
    /** NEW sticker pop (task 20). */
    shopNewPopMs: ms(),
    /** Delay between each exact-kill icon's pop-in on the win/lose screens (task 16 req. 5). */
    iconStaggerMs: ms(),
    /** One cycle of the lose screen's dancing-robot wiggle (task 16 req. 3). */
    danceMs: ms(),
    /** Delay between each dancing robot's animation start, so they wiggle out of sync. */
    danceStaggerMs: ms(),
  }),
  /** Planning-phase danger glow (task 15, GDD §12.2 "Planning-phase cues"): a lane whose robot
   * sits on column 1 pulses red at the base strip and that robot wobbles. Derived from `run`
   * fresh every frame — never an event, never cached. */
  danger: z.object({
    /** One full pulse cycle (dim → bright → dim). */
    pulseMs: ms(),
    minAlpha: z.number().min(0).max(1),
    maxAlpha: z.number().min(0).max(1),
    color: z.string().min(1),
    /** How far the at-risk robot rocks side to side (degrees, one way). */
    wobbleDeg: z.number().nonnegative(),
    wobbleMs: ms(),
  }),
  /** In-play HUD fire control (▶ Go). Presentation only — never changes an outcome. */
  hud: z.object({
    /** Fill of the Go button. Green reads as "do this next" against the dark HUD. */
    goColor: z.string().min(1),
    /** How long planning can sit with no tile/cannon/tray change before Go wiggles. */
    goNudgeIdleMs: ms(),
    /** One wiggle cycle (a short shake, then rest). */
    goNudgeWiggleMs: z.number().positive(),
    /** How far Go rocks each way, in degrees. */
    goNudgeWiggleDeg: z.number().nonnegative(),
  }),
  /** Planning-hint numerals under tiles (task 24, GDD §5.7). Presentation only. */
  hints: z.object({
    color: z.string().min(1),
  }),
  /** Generated Web Audio recipes (task 31, GDD §12.4). No Hz/gain/duration in code. */
  audio: AudioSettingsSchema,
});

/** References an existing tile definition by id (e.g. `"add:5"`) — used by shop guarantees,
 * a level's pre-placed board tiles and tray, not a full `TileDefSchema` (a shop/level names
 * tiles, it doesn't redefine them). Same narrowing rationale as `TileDefSchema`'s `.transform`. */
const TileIdRefSchema = z
  .string()
  .regex(/^(add|sub|mul):\d+$/, 'must be a tile id like "add:5"')
  .transform((id) => id as TileId);

// --- shop.json (GDD §8.3–8.5, §10.2, TR §9) ---

/** Legal N range for a table `kind` — the same bounds as `TileDefSchema` (GDD §9.1). */
function nRangeForKind(kind: 'add' | 'sub' | 'mul'): [number, number] {
  return kind === 'mul' ? [2, 10] : [1, 10];
}

function rangesOverlap(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

const NRangeSchema = z.tuple([z.number().int(), z.number().int()]);

const ShopTableEntrySchema = z
  .strictObject({
    kind: TileKindSchema,
    /** Inclusive `[min, max]` drawn with `nextInt` after `pickWeighted` (TR §9). */
    n: NRangeSchema,
    weight: z.number().int().positive(),
  })
  .superRefine((entry, ctx) => {
    const [min, max] = entry.n;
    if (min > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['n'],
        message: `n min ${min} is greater than max ${max}`,
      });
    }
    const [lo, hi] = nRangeForKind(entry.kind);
    if (min < lo || max > hi) {
      ctx.addIssue({
        code: 'custom',
        path: ['n'],
        message: `${entry.kind} n must be ${lo}-${hi}`,
      });
    }
  });

const ShopGuaranteeSchema = z.union([
  z.strictObject({ tileId: TileIdRefSchema }),
  z
    .strictObject({
      kind: TileKindSchema,
      n: NRangeSchema.optional(),
    })
    .superRefine((guarantee, ctx) => {
      if (!guarantee.n) return;
      const [min, max] = guarantee.n;
      if (min > max) {
        ctx.addIssue({
          code: 'custom',
          path: ['n'],
          message: `n min ${min} is greater than max ${max}`,
        });
      }
      const [lo, hi] = nRangeForKind(guarantee.kind);
      if (min < lo || max > hi) {
        ctx.addIssue({
          code: 'custom',
          path: ['n'],
          message: `${guarantee.kind} n must be ${lo}-${hi}`,
        });
      }
    }),
]);

const ShopVisitSchema = z
  .strictObject({
    /** 1-based: the wave just cleared (`= waveIndex + 1`). Unique across `shops`. */
    afterWave: z.number().int().positive(),
    guarantees: z.array(ShopGuaranteeSchema),
    table: z.array(ShopTableEntrySchema).min(1),
  })
  .superRefine((visit, ctx) => {
    visit.guarantees.forEach((guarantee, index) => {
      if ('tileId' in guarantee) return;
      const matches = visit.table.filter((entry) => {
        if (entry.kind !== guarantee.kind) return false;
        if (!guarantee.n) return true;
        return rangesOverlap(entry.n, guarantee.n);
      });
      if (matches.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['guarantees', index],
          message: 'guarantee is not satisfiable by this table',
        });
      }
    });
  });

export const ShopFileSchema = z
  .strictObject({
    tileSlots: z.number().int().min(1),
    prices: z.strictObject({
      add: z.number().int().nonnegative(),
      sub: z.number().int().nonnegative(),
      mulLow: z.number().int().nonnegative(),
      mulHigh: z.number().int().nonnegative(),
    }),
    cannon: z.strictObject({
      base: z.number().int().nonnegative(),
      step: z.number().int().nonnegative(),
    }),
    upgrade: z.strictObject({
      base: z.number().int().nonnegative(),
      step: z.number().int().nonnegative(),
    }),
    shops: z.array(ShopVisitSchema),
  })
  .superRefine((shop, ctx) => {
    const seen = new Set<number>();
    shop.shops.forEach((visit, index) => {
      if (seen.has(visit.afterWave)) {
        ctx.addIssue({
          code: 'custom',
          path: ['shops', index, 'afterWave'],
          message: `duplicate afterWave ${visit.afterWave}`,
        });
      }
      seen.add(visit.afterWave);
      if (visit.guarantees.length > shop.tileSlots) {
        ctx.addIssue({
          code: 'custom',
          path: ['shops', index, 'guarantees'],
          message: `guarantees.length ${visit.guarantees.length} exceeds tileSlots ${shop.tileSlots}`,
        });
      }
    });
  });

/** Validated `shop.json` (TR §9). */
export type ShopFile = z.infer<typeof ShopFileSchema>;

// --- levels.json — expanded in task 06 (hand-authored puzzle levels, M1) ---

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

const RobotTemplateSchema = z
  .strictObject({
    id: z.string().min(1),
    trait: TraitSchema,
    isBoss: z.boolean(),
  })
  .superRefine((robot, ctx) => {
    if (robot.isBoss && robot.trait.type !== 'none') {
      ctx.addIssue({
        code: 'custom',
        path: ['trait'],
        message: 'Boss trait must be none',
      });
    }
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

// --- waves.json (GDD §10.3, §10.5, TR §9) — authored (waves 1–7) or procedural (waves 8–9) ---

export const LANE_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
export type LaneLetter = (typeof LANE_LETTERS)[number];

/** Highest HP a normal spawn may roll: never exceeds 99 (GDD §2.1 / §6.6). The Boss is the
 * only four-digit robot; authored spawns may go to 1000, and the cross-file pass in
 * `GameDataSchema` keeps non-Boss templates at 99. */
const MAX_NORMAL_SPAWN_HP = 99;
const MAX_BOSS_SPAWN_HP = 1000;

function spawnHpRange(maxHp: number) {
  const hp = z.number().int().min(1).max(maxHp);
  return z.tuple([hp, hp]).superRefine(([min, max], ctx) => {
    if (min > max) {
      ctx.addIssue({ code: 'custom', message: `hp min ${min} is greater than max ${max}` });
    }
  });
}

/** Per-spawn authored HP: 1 ≤ min ≤ max ≤ Boss maximum. Non-Boss templates are capped at 99
 * in `GameDataSchema` (a spawn schema cannot see `robots.json`). */
const SpawnHpRangeSchema = spawnHpRange(MAX_BOSS_SPAWN_HP);

/** Procedural groups never include the Boss (pool check) and stay at the two-digit cap. */
const NormalSpawnHpRangeSchema = spawnHpRange(MAX_NORMAL_SPAWN_HP);

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
  hp: SpawnHpRangeSchema,
});

const AuthoredWaveSchema = z
  .strictObject({
    id: z.string().min(1),
    spawns: z.array(WaveSpawnSchema).min(1),
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

const ProceduralGroupSchema = z
  .strictObject({
    /** 1-based turn within the wave. Unique across groups (TR §9). */
    turn: z.number().int().min(1),
    /** Robots this group spawns; schema bound 1–5, shipped tables stay ≤ 4 (task 25). */
    count: z.number().int().min(1).max(5),
    /** `[min, max]`, both inclusive; rolled per robot at wave start. ≤ 99 (no Boss). */
    hp: NormalSpawnHpRangeSchema,
    /** Distinct `robots.json` ids drawn without replacement (grill B). */
    pool: z.array(z.string().min(1)).min(1),
    /** Optional per-template HP override. Missing ids keep `hp`. Keys must be in `pool`. */
    hpByRobot: z.record(z.string().min(1), NormalSpawnHpRangeSchema).optional(),
  })
  .superRefine((group, ctx) => {
    const seen = new Set<string>();
    group.pool.forEach((id, index) => {
      if (seen.has(id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['pool', index],
          message: `duplicate pool id "${id}"`,
        });
      }
      seen.add(id);
    });
    if (group.count > group.pool.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['count'],
        message: `count ${group.count} exceeds pool.length ${group.pool.length}`,
      });
    }
    if (group.hpByRobot) {
      for (const id of Object.keys(group.hpByRobot)) {
        if (!seen.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['hpByRobot', id],
            message: `hpByRobot key "${id}" is not in this group's pool`,
          });
        }
      }
    }
  });

const ProceduralWaveSchema = z
  .strictObject({
    id: z.string().min(1),
    procedural: z.strictObject({
      groups: z.array(ProceduralGroupSchema).min(1),
    }),
  })
  .superRefine((wave, ctx) => {
    if (!wave.procedural.groups.some((group) => group.turn === 1)) {
      ctx.addIssue({
        code: 'custom',
        path: ['procedural', 'groups'],
        message: 'a wave needs a group on turn 1',
      });
    }

    const seenTurns = new Set<number>();
    wave.procedural.groups.forEach((group, index) => {
      if (seenTurns.has(group.turn)) {
        ctx.addIssue({
          code: 'custom',
          path: ['procedural', 'groups', index, 'turn'],
          message: `duplicate turn ${group.turn}`,
        });
      }
      seenTurns.add(group.turn);
    });
  });

/** A wave is either authored (`spawns`) or procedural (`procedural`), never both (TR §9).
 * Dispatch on which key is present (instead of `z.union`) so authored-wave issue paths like
 * `spawns[0].lane` stay intact. Narrow with `'spawns' in wave` so every reader picks a branch. */
const WaveDefSchema = z.unknown().transform((value, ctx) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    ctx.addIssue({ code: 'custom', message: 'expected a wave object' });
    return z.NEVER;
  }
  const record = value as Record<string, unknown>;
  const hasSpawns = Object.hasOwn(record, 'spawns');
  const hasProcedural = Object.hasOwn(record, 'procedural');
  if (hasSpawns && hasProcedural) {
    ctx.addIssue({
      code: 'custom',
      message: 'a wave cannot have both spawns and procedural',
    });
    return z.NEVER;
  }
  if (hasSpawns) {
    const parsed = AuthoredWaveSchema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
      }
      return z.NEVER;
    }
    return parsed.data;
  }
  if (hasProcedural) {
    const parsed = ProceduralWaveSchema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
      }
      return z.NEVER;
    }
    return parsed.data;
  }
  ctx.addIssue({
    code: 'custom',
    message: 'a wave needs either spawns or procedural',
  });
  return z.NEVER;
});

/** One wave from `waves.json`. Rolled into concrete `SpawnEntry`s by `rollWave`. */
export type WaveDef = z.infer<typeof WaveDefSchema>;

/** Exported for the scenario runner's `waves:` override (TR §12, task 13 requirement 5): an
 * inline `waves.json`-shaped array replacing `data.waves.waves` for one scenario, structurally
 * validated the same way a real `waves.json` is — including procedural groups (task 25).
 * Cross-file checks against `robots.json` ids are not repeated here — scenario waves reference
 * the real shipped `robots`, and an unknown id surfaces as its own clear runtime error where
 * it's actually used (`rollWave`/`spawn`). */
export const WavesFileSchema = z.strictObject({
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
    }),
});

export type WavesFile = z.infer<typeof WavesFileSchema>;

// --- difficulty.json (GDD §10.7, task 28) ---

export const DifficultyIdSchema = z.enum(['easy', 'normal', 'hard']);

const HpBandSchema = z
  .strictObject({
    /** Integer percent; 100 = unchanged. */
    mul: z.number().int().positive(),
    min: z.number().int().min(1),
    max: z.number().int().min(1),
  })
  .superRefine((band, ctx) => {
    if (band.min > band.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['min'],
        message: `min ${band.min} exceeds max ${band.max}`,
      });
    }
  });

const DifficultyModeSchema = z.strictObject({
  label: z.string().min(1),
  stars: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  hp: z.strictObject({
    nonBoss: HpBandSchema,
    parity: HpBandSchema,
    boss: HpBandSchema,
  }),
  countDelta: z.number().int(),
  minCount: z.number().int().min(1).max(5),
  maxCount: z.number().int().min(1).max(5),
  dropTemplates: z.array(z.string().min(1)),
});

export const DifficultyFileSchema = z
  .strictObject({
    default: DifficultyIdSchema,
    modes: z.strictObject({
      easy: DifficultyModeSchema,
      normal: DifficultyModeSchema,
      hard: DifficultyModeSchema,
    }),
  })
  .superRefine((file, ctx) => {
    if (file.default !== 'normal') {
      ctx.addIssue({
        code: 'custom',
        path: ['default'],
        message: 'default must be "normal"',
      });
    }
    const expectedLabels: Record<'easy' | 'normal' | 'hard', string> = {
      easy: 'Easy',
      normal: 'Normal',
      hard: 'Hard',
    };
    const starSeen = new Set<number>();
    for (const id of DifficultyIdSchema.options) {
      const mode = file.modes[id];
      if (mode.label !== expectedLabels[id]) {
        ctx.addIssue({
          code: 'custom',
          path: ['modes', id, 'label'],
          message: `label must be "${expectedLabels[id]}"`,
        });
      }
      if (starSeen.has(mode.stars)) {
        ctx.addIssue({
          code: 'custom',
          path: ['modes', id, 'stars'],
          message: `duplicate stars ${mode.stars}`,
        });
      }
      starSeen.add(mode.stars);
      if (mode.minCount > mode.maxCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['modes', id, 'minCount'],
          message: `minCount ${mode.minCount} exceeds maxCount ${mode.maxCount}`,
        });
      }
      if (mode.hp.nonBoss.max > MAX_NORMAL_SPAWN_HP) {
        ctx.addIssue({
          code: 'custom',
          path: ['modes', id, 'hp', 'nonBoss', 'max'],
          message: `nonBoss max ${mode.hp.nonBoss.max} exceeds ${MAX_NORMAL_SPAWN_HP}`,
        });
      }
      if (mode.hp.parity.max > MAX_NORMAL_SPAWN_HP) {
        ctx.addIssue({
          code: 'custom',
          path: ['modes', id, 'hp', 'parity', 'max'],
          message: `parity max ${mode.hp.parity.max} exceeds ${MAX_NORMAL_SPAWN_HP}`,
        });
      }
      if (mode.hp.boss.max > MAX_BOSS_SPAWN_HP) {
        ctx.addIssue({
          code: 'custom',
          path: ['modes', id, 'hp', 'boss', 'max'],
          message: `boss max ${mode.hp.boss.max} exceeds ${MAX_BOSS_SPAWN_HP}`,
        });
      }
      const drops = new Set<string>();
      mode.dropTemplates.forEach((idDrop, index) => {
        if (drops.has(idDrop)) {
          ctx.addIssue({
            code: 'custom',
            path: ['modes', id, 'dropTemplates', index],
            message: `duplicate dropTemplates id "${idDrop}"`,
          });
        }
        drops.add(idDrop);
      });
    }
  });

export type DifficultyFile = z.infer<typeof DifficultyFileSchema>;
export type DifficultyMode = z.infer<typeof DifficultyModeSchema>;

// --- Combined ---

export const GameDataSchema = z
  .object({
    tiles: TilesFileSchema,
    robots: RobotsFileSchema,
    economy: EconomyFileSchema,
    shop: ShopFileSchema,
    waves: WavesFileSchema,
    difficulty: DifficultyFileSchema,
    levels: LevelsFileSchema,
    presentation: PresentationFileSchema,
  })
  // Cross-file references: checked here, once every file has parsed on its own. Issue paths
  // start with the file key, so `parseGameData` reports them as `waves.json: waves[0]...`.
  .superRefine((data, ctx) => {
    const robotIds = new Set(data.robots.map((robot) => robot.id));
    const tileIds = new Set<string>(data.tiles.map((tile) => tile.id));
    for (const id of DifficultyIdSchema.options) {
      data.difficulty.modes[id].dropTemplates.forEach((dropId, dropIndex) => {
        if (!robotIds.has(dropId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['difficulty', 'modes', id, 'dropTemplates', dropIndex],
            message: `unknown robot id "${dropId}"`,
          });
          return;
        }
        const template = data.robots.find((robot) => robot.id === dropId);
        if (template?.isBoss) {
          ctx.addIssue({
            code: 'custom',
            path: ['difficulty', 'modes', id, 'dropTemplates', dropIndex],
            message: `dropTemplates may not name a Boss template "${dropId}"`,
          });
        }
      });
    }
    data.waves.waves.forEach((wave, waveIndex) => {
      if ('spawns' in wave) {
        const reservedLanes = new Set<number>();
        wave.spawns.forEach((spawn, spawnIndex) => {
          if (!robotIds.has(spawn.robot)) {
            ctx.addIssue({
              code: 'custom',
              path: ['waves', 'waves', waveIndex, 'spawns', spawnIndex, 'robot'],
              message: `unknown robot id "${spawn.robot}"`,
            });
            return;
          }
          const template = data.robots.find((robot) => robot.id === spawn.robot);
          if (template && !template.isBoss && spawn.hp[1] > MAX_NORMAL_SPAWN_HP) {
            ctx.addIssue({
              code: 'custom',
              path: ['waves', 'waves', waveIndex, 'spawns', spawnIndex, 'hp'],
              message: `hp max ${spawn.hp[1]} exceeds ${MAX_NORMAL_SPAWN_HP} for non-Boss template "${spawn.robot}"`,
            });
          }
          if (!template?.isBoss) {
            if (typeof spawn.lane === 'number') reservedLanes.add(spawn.lane);
            return;
          }
          if (typeof spawn.lane !== 'number') {
            ctx.addIssue({
              code: 'custom',
              path: ['waves', 'waves', waveIndex, 'spawns', spawnIndex, 'lane'],
              message: 'Boss must use a fixed lane (2x2 footprint)',
            });
            return;
          }
          if (!isLane(spawn.lane + 1)) {
            ctx.addIssue({
              code: 'custom',
              path: ['waves', 'waves', waveIndex, 'spawns', spawnIndex, 'lane'],
              message: `Boss 2x2 does not fit on lane ${spawn.lane}`,
            });
            return;
          }
          for (const lane of reservedSpawnLanes(spawn.lane, true)) {
            reservedLanes.add(lane);
          }
        });
        const letters = new Set(
          wave.spawns.map((spawn) => spawn.lane).filter((lane) => typeof lane === 'string'),
        );
        const otherFixed = new Set<number>();
        const bossReserved = new Set<number>();
        let bossOverlap = false;
        for (const spawn of wave.spawns) {
          if (typeof spawn.lane !== 'number') continue;
          const template = data.robots.find((robot) => robot.id === spawn.robot);
          if (template?.isBoss) {
            for (const lane of reservedSpawnLanes(spawn.lane, true)) {
              if (bossReserved.has(lane)) bossOverlap = true;
              bossReserved.add(lane);
            }
          } else {
            otherFixed.add(spawn.lane);
          }
        }
        for (const lane of otherFixed) {
          if (bossReserved.has(lane)) bossOverlap = true;
        }
        if (bossOverlap) {
          ctx.addIssue({
            code: 'custom',
            path: ['waves', 'waves', waveIndex, 'spawns'],
            message: 'Boss 2x2 overlaps another fixed lane',
          });
        }
        if (letters.size > LANES - reservedLanes.size) {
          ctx.addIssue({
            code: 'custom',
            path: ['waves', 'waves', waveIndex, 'spawns'],
            message: `${letters.size} lane letters but only ${LANES - reservedLanes.size} lanes are not taken by fixed or Boss 2x2 cells`,
          });
        }
        return;
      }
      wave.procedural.groups.forEach((group, groupIndex) => {
        group.pool.forEach((id, poolIndex) => {
          const path = [
            'waves',
            'waves',
            waveIndex,
            'procedural',
            'groups',
            groupIndex,
            'pool',
            poolIndex,
          ] as const;
          if (!robotIds.has(id)) {
            ctx.addIssue({
              code: 'custom',
              path: [...path],
              message: `unknown robot id "${id}"`,
            });
            return;
          }
          const template = data.robots.find((robot) => robot.id === id);
          if (template?.isBoss) {
            ctx.addIssue({
              code: 'custom',
              path: [...path],
              message: `pool may not name a Boss template "${id}"`,
            });
          }
        });
      });
    });

    const usedCategories = new Set(data.tiles.map((tile) => tile.priceCategory));
    for (const category of usedCategories) {
      if (!(category in data.shop.prices)) {
        ctx.addIssue({
          code: 'custom',
          path: ['shop', 'prices'],
          message: `missing priceCategory "${category}" used by tiles.json`,
        });
      }
    }

    data.shop.shops.forEach((visit, shopIndex) => {
      visit.table.forEach((entry, entryIndex) => {
        const [min, max] = entry.n;
        for (let n = min; n <= max; n += 1) {
          const tileId = `${entry.kind}:${n}`;
          if (!tileIds.has(tileId)) {
            ctx.addIssue({
              code: 'custom',
              path: ['shop', 'shops', shopIndex, 'table', entryIndex, 'n'],
              message: `no tiles.json entry for "${tileId}"`,
            });
          }
        }
      });
      visit.guarantees.forEach((guarantee, guaranteeIndex) => {
        if (!('tileId' in guarantee)) return;
        if (!tileIds.has(guarantee.tileId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['shop', 'shops', shopIndex, 'guarantees', guaranteeIndex, 'tileId'],
            message: `unknown tile id "${guarantee.tileId}"`,
          });
        }
      });
    });

    // Coverage: every non-final wave must have a shop table. Extra tables for waves that
    // do not exist yet (afterWave ≥ waves.length) are allowed so M3 can ship six shops
    // while waves.json still has three waves.
    const afterWaves = new Set(data.shop.shops.map((visit) => visit.afterWave));
    const lastShopWave = data.waves.waves.length - 1;
    for (let afterWave = 1; afterWave <= lastShopWave; afterWave += 1) {
      if (!afterWaves.has(afterWave)) {
        ctx.addIssue({
          code: 'custom',
          path: ['shop', 'shops'],
          message: `missing table for afterWave ${afterWave} (waves.json has ${data.waves.waves.length} waves; every non-final wave needs a shop)`,
        });
      }
    }
  });

/** The validated shape of everything in `/data`, combined. `applyCommand` (TR §5, task 06) and
 * `resolveTurn` (TR §6, task 07) both take a `GameData` alongside `RunState`. */
export type GameData = z.infer<typeof GameDataSchema>;
