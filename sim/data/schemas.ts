// Zod schemas for /data/*.json (GDD §13, TR §9). Validated once at load time by
// `parseGameData` (`./load.ts`), which throws a readable `<file>.json: <path>: <message>`
// error on the first failure — so a broken data file is a loud, precise failure, not a
// mysterious runtime bug three layers away.
//
// `robots.json`, `shop.json`, `waves.json` are not needed until M3/M4 — their schemas accept
// only the minimal placeholder shape shipped in `/data` today, marked below. Expanding them is
// the job of the milestone that adds their real content, not this task.

import { z } from 'zod';
import { LANES } from '../core/coords';

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
  });

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

const PresentationFileSchema = z.object({
  pacing: z.object({
    ballCellDurationMs: z.number().positive(),
    perTilePauseMs: z.number().nonnegative(),
    laneGapMs: z.number().nonnegative(),
    advanceDurationMs: z.number().positive(),
  }),
  tileColors: z.record(TileColorSchema, z.string().min(1)),
});

// --- robots.json — expanded in M3/M4 (robot templates, traits, visual keys) ---

const RobotsFileSchema = z.array(z.unknown());

// --- shop.json — expanded in M3 (price table, cannon/upgrade formulas, offer tables, ladder) ---

const ShopFileSchema = z.object({}).passthrough();

// --- waves.json — expanded in M2 (spawn schedules, procedural tables) ---

const WavesFileSchema = z.object({ waves: z.array(z.unknown()) });

// --- levels.json — expanded in M1/task 11 (hand-authored puzzle levels) ---

const LevelsFileSchema = z.object({ levels: z.array(z.unknown()) });

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
