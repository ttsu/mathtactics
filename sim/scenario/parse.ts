// Scenario YAML parser (GDD §15.1, TR §12, task 08). Pure: `parseScenario(yamlText, sourceName)`
// takes already-read text and returns a validated, fully-structured `Scenario` — no filesystem
// access here (that's `scripts/sim.ts` and `tests/scenarios.test.ts`'s job; `/sim` must not touch
// Node built-ins, TR §2). `yaml` may only be imported inside `/sim/scenario` (TR §2, enforced by
// the eslint layer rule) — this is that one place.
//
// Board token grammar (TR §12, this task's brief):
//   col 0:        "C" (cannon) | "." (empty)
//   tile cells:   "." (empty) | "+N" | "-N"/"−N" | "xN"/"×N" (tile) |
//                 "R<hp>" | "R<hp>[tile]" (robot, optionally standing on a tile), each optionally
//                 suffixed ":bb" | ":odd" | ":even" | ":w2" | ":w5" | ":w10" (trait)
// Every row must have exactly 8 space-separated tokens; every board must have exactly 5 rows
// (GDD §3.1). Malformed tokens throw an `Error` naming the row (1-based, matching the YAML board
// list) and lane, and the 0-based column (matching the game's own column numbering).

import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { COLS, LANES } from '../core/coords';
import type { Col, Lane } from '../core/coords';
import type { Command, CommandError, Trait, TileId, TileKind } from '../core/types';
import type { ExpectedEvent } from './match';

// --- Trait shorthand (board tokens and `waiting` entries share this) ---

const TRAIT_CODES: Record<string, Trait> = {
  bb: { type: 'bounceBack' },
  odd: { type: 'oddOnly' },
  even: { type: 'evenOnly' },
  w2: { type: 'weakness', n: 2 },
  w5: { type: 'weakness', n: 5 },
  w10: { type: 'weakness', n: 10 },
};

const TRAIT_CODE_LIST = Object.keys(TRAIT_CODES).join(', ');

function traitFromCode(code: string, where: string): Trait {
  const trait = TRAIT_CODES[code];
  if (!trait) {
    throw new Error(`${where}: unknown trait code "${code}" (expected one of ${TRAIT_CODE_LIST})`);
  }
  return trait;
}

// --- Tile token grammar ("+4", "-2"/"−2", "x3"/"×3") ---

const TILE_TOKEN_RE = /^([+\-−x×])(\d+)$/;

function parseTileToken(token: string): { tileId: TileId } | null {
  const match = TILE_TOKEN_RE.exec(token);
  if (!match) return null;
  const n = Number(match[2]);
  if (!Number.isInteger(n) || n <= 0) return null;
  const symbol = match[1]!;
  const kind: TileKind = symbol === '+' ? 'add' : symbol === '-' || symbol === '−' ? 'sub' : 'mul';
  return { tileId: `${kind}:${n}` as TileId };
}

const TRAY_TILE_ID_RE = /^(add|sub|mul):\d+$/;

// --- Robot token grammar ("R13", "R13[x3]", "R13:bb", "R13[x3]:odd") ---

const ROBOT_TOKEN_RE = /^R(\d+)(?:\[([^\]]*)\])?(?::([a-zA-Z0-9]+))?$/;

// --- Zod: raw shape validation (structure only — board *tokens* are parsed by hand below so
// mistakes there can report a row/column, which zod's generic path-based errors can't). ---

const CellRawSchema = z.object({
  lane: z.number().int().min(0).max(LANES - 1),
  col: z.number().int().min(0).max(COLS - 1),
});

const CommandObjectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('placeTile'), pieceId: z.string().min(1), to: CellRawSchema }),
  z.object({ type: z.literal('moveTile'), from: CellRawSchema, to: CellRawSchema }),
  z.object({ type: z.literal('returnTile'), from: CellRawSchema }),
  z.object({
    type: z.literal('moveCannon'),
    fromLane: z.number().int().min(0).max(LANES - 1),
    toLane: z.number().int().min(0).max(LANES - 1),
  }),
  z.object({ type: z.literal('undo') }),
  z.object({ type: z.literal('endTurn') }),
]);

/** String shorthand ("endTurn", "undo") or the object form of any planning/`endTurn`/`undo`
 * command (task 08 ruling: scenarios build state directly, so `loadLevel`/`newRun` and the M3
 * shop commands aren't meaningful here). */
const RawCommandSchema = z.union([z.literal('endTurn'), z.literal('undo'), CommandObjectSchema]);

const RawExpectedEventSchema = z.object({ type: z.string().min(1) }).passthrough();

const RawWaitingRobotSchema = z.object({
  lane: z.number().int().min(0).max(LANES - 1),
  hp: z.number().int().positive(),
  maxHp: z.number().int().positive().optional(),
  trait: z.string().min(1).optional(),
});

const CommandErrorSchema = z.enum([
  'wrong_phase',
  'cell_locked',
  'cell_occupied',
  'not_a_tile_cell',
  'no_tile_here',
  'piece_not_in_tray',
  'slot_occupied',
  'no_cannon_here',
  'nothing_to_undo',
  'insufficient_coins',
  'offer_unavailable',
]);

const RawScenarioSchema = z.object({
  name: z.string().min(1),
  mode: z.enum(['level', 'run']).default('level'),
  /** A shipped level id from `data/levels.json` (task 11): the initial state is that level, built
   * by `buildLevelState` — mutually exclusive with `board` (checked in `parseScenario`). */
  level: z.string().min(1).optional(),
  baseValue: z.number().int().optional(),
  coins: z.number().int().optional(),
  seed: z.string().min(1).optional(),
  baseHp: z.number().int().positive().optional(),
  waveIndex: z.number().int().nonnegative().optional(),
  turn: z.number().int().positive().optional(),
  board: z
    .array(z.string())
    .length(5, 'board must have exactly 5 lane rows (GDD §3.1)')
    .optional(),
  tray: z.array(z.string()).optional(),
  waiting: z.array(RawWaitingRobotSchema).default([]),
  commands: z.array(RawCommandSchema).default([]),
  expectEvents: z.array(RawExpectedEventSchema).default([]),
  expectState: z.record(z.string(), z.unknown()).optional(),
  expectError: CommandErrorSchema.optional(),
});

function formatZodPath(path: (string | number | symbol)[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return acc.length === 0 ? String(segment) : `${acc}.${String(segment)}`;
  }, '');
}

// --- Parsed shape ---

export interface Scenario {
  name: string;
  mode: 'level' | 'run';
  /** Set when the scenario starts from a shipped level (`level: <levelId>`, task 11) instead of a
   * `board`. The board fields below (`baseValue`, `cannonLanes`, `boardTiles`, `robots`, `tray`)
   * are then empty — the level supplies them. */
  level?: string;
  /** The id the initial state carries: the shipped level's id when `level` is set, else derived
   * for `buildLevelState` (task 08 ruling) as `scenario:<file-or-name-slug>`. */
  levelId: string;
  /** Always set for a `board` scenario; unset for a `level` scenario. */
  baseValue?: number;
  coins?: number;
  seed?: string;
  baseHp?: number;
  waveIndex?: number;
  turn?: number;
  cannonLanes: Lane[];
  boardTiles: { lane: Lane; col: Col; tileId: TileId }[];
  robots: { lane: Lane; col: Col; hp: number; trait: Trait }[];
  tray: TileId[];
  /** Off-board robots (`col: null`), task 08 ruling. */
  waiting: { lane: Lane; hp: number; maxHp: number; trait: Trait }[];
  commands: Command[];
  expectEvents: ExpectedEvent[];
  expectState?: Record<string, unknown>;
  expectError?: CommandError;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'scenario'
  );
}

/**
 * Parses one scenario file's YAML text into a `Scenario`. `sourceName` (typically the file's
 * basename, extension stripped) drives the derived `levelId`; falls back to slugifying `name`
 * when omitted. Throws a plain `Error` with a precise, human-readable message on the first
 * problem found — malformed YAML, a structural mismatch (zod), or a bad board token (naming its
 * row/lane and column).
 */
export function parseScenario(yamlText: string, sourceName?: string): Scenario {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (err) {
    throw new Error(`scenario: invalid YAML — ${(err as Error).message}`, { cause: err });
  }

  const parsed = RawScenarioSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const path = formatZodPath(issue.path);
    throw new Error(`scenario${path ? ` ${path}` : ''}: ${issue.message}`);
  }
  const data = parsed.data;

  // A scenario starts from exactly one of: a hand-written `board` (+ `baseValue`, `tray`), or a
  // shipped `level` (task 11), which supplies all three.
  if (data.level !== undefined) {
    const conflicting = (['board', 'baseValue', 'tray'] as const).filter(
      (key) => data[key] !== undefined,
    );
    if (conflicting.length > 0) {
      throw new Error(
        `scenario: "level" and "${conflicting.join('"/"')}" cannot be used together — ` +
          `a level supplies its own board, baseValue and tray`,
      );
    }
  } else {
    if (data.board === undefined) {
      throw new Error('scenario: needs either "board" (with "baseValue") or "level: <levelId>"');
    }
    if (data.baseValue === undefined) {
      throw new Error('scenario baseValue: required when the scenario has a "board"');
    }
  }

  const cannonLanes: Lane[] = [];
  const boardTiles: Scenario['boardTiles'] = [];
  const robots: Scenario['robots'] = [];

  (data.board ?? []).forEach((rowText, laneIndex) => {
    const lane = laneIndex as Lane;
    const tokens = rowText.trim().split(/\s+/).filter((token) => token.length > 0);
    if (tokens.length !== COLS) {
      throw new Error(
        `scenario board row ${lane + 1} (lane ${lane}): expected ${COLS} space-separated ` +
          `tokens, got ${tokens.length}`,
      );
    }

    tokens.forEach((token, col) => {
      const where = `scenario board row ${lane + 1} (lane ${lane}), col ${col}`;

      if (col === 0) {
        if (token === 'C') cannonLanes.push(lane);
        else if (token !== '.') {
          throw new Error(`${where}: col 0 must be "C" (cannon) or "." (empty), got "${token}"`);
        }
        return;
      }

      if (token === '.') return;
      if (token === 'C') {
        throw new Error(`${where}: "C" is only valid in col 0 (the cannon slot, GDD §3.1)`);
      }

      const robotMatch = ROBOT_TOKEN_RE.exec(token);
      if (robotMatch) {
        const hp = Number(robotMatch[1]);
        if (!Number.isInteger(hp) || hp <= 0) {
          throw new Error(`${where}: robot hp must be a positive integer, got "${robotMatch[1]}"`);
        }

        if (robotMatch[2] !== undefined) {
          const inner = robotMatch[2];
          const tile = parseTileToken(inner);
          if (!tile) {
            throw new Error(
              `${where}: invalid tile "${inner}" inside robot brackets ` +
                `(expected e.g. "+4", "-2", "x3")`,
            );
          }
          boardTiles.push({ lane, col: col as Col, tileId: tile.tileId });
        }

        const trait = robotMatch[3] !== undefined ? traitFromCode(robotMatch[3], where) : { type: 'none' as const };
        robots.push({ lane, col: col as Col, hp, trait });
        return;
      }

      const tile = parseTileToken(token);
      if (tile) {
        boardTiles.push({ lane, col: col as Col, tileId: tile.tileId });
        return;
      }

      throw new Error(
        `${where}: unrecognized token "${token}" (expected ".", a tile like "+4"/"-2"/"x3", ` +
          `or a robot like "R13"/"R13[x3]"/"R13:bb")`,
      );
    });
  });

  const tray: TileId[] = (data.tray ?? []).map((id, index) => {
    if (!TRAY_TILE_ID_RE.test(id)) {
      throw new Error(`scenario tray[${index}]: "${id}" is not a valid tile id (e.g. "add:5")`);
    }
    return id as TileId;
  });

  const waiting: Scenario['waiting'] = data.waiting.map((entry, index) => {
    const trait = entry.trait !== undefined ? traitFromCode(entry.trait, `scenario waiting[${index}]`) : { type: 'none' as const };
    const maxHp = entry.maxHp ?? entry.hp;
    if (maxHp < entry.hp) {
      throw new Error(
        `scenario waiting[${index}]: maxHp (${maxHp}) must be >= hp (${entry.hp})`,
      );
    }
    return { lane: entry.lane as Lane, hp: entry.hp, maxHp, trait };
  });

  const commands: Command[] = data.commands.map((command) => {
    if (command === 'endTurn') return { type: 'endTurn' };
    if (command === 'undo') return { type: 'undo' };
    return command as Command;
  });

  const expectEvents = data.expectEvents as ExpectedEvent[];

  const levelId = data.level ?? `scenario:${slugify(sourceName ?? data.name)}`;

  return {
    name: data.name,
    mode: data.mode,
    level: data.level,
    levelId,
    baseValue: data.baseValue,
    coins: data.coins,
    seed: data.seed,
    baseHp: data.baseHp,
    waveIndex: data.waveIndex,
    turn: data.turn,
    cannonLanes,
    boardTiles,
    robots,
    tray,
    waiting,
    commands,
    expectEvents,
    expectState: data.expectState,
    expectError: data.expectError,
  };
}
