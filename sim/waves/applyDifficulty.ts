// Difficulty overlay (GDD §10.7, task 28). Pure: maps a `waves.json` wave through
// `data.difficulty.modes[id]` before `rollWave`. Normal (mul 100, countDelta 0, no drops) is
// identity on shipped waves. Hard scales procedural non-Boss HP (120%) and still adds
// stretch pressure; authored waves 1–7 / 10 keep Normal HP. Overlay consumes no RNG —
// `rollWave` still owns the `wave` stream.

import type { DifficultyId } from '../core/types';
import type { DifficultyMode, GameData, WaveDef } from '../data/schemas';

type HpBand = DifficultyMode['hp']['nonBoss'];
type HpRange = [number, number];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** `Math.round` is half toward +∞; HP values are positive so that is half away from 0. */
function scaleHp(n: number, band: HpBand): number {
  return clamp(Math.round((n * band.mul) / 100), band.min, band.max);
}

function scaleRange(range: HpRange, band: HpBand): HpRange {
  const lo = scaleHp(range[0], band);
  const hi = scaleHp(range[1], band);
  return lo > hi ? [lo, lo] : [lo, hi];
}

function hpBandFor(
  robotId: string,
  robots: GameData['robots'],
  mode: DifficultyMode,
): HpBand {
  const template = robots.find((robot) => robot.id === robotId);
  if (template?.isBoss) return mode.hp.boss;
  if (robotId === 'odd-only' || robotId === 'even-only') return mode.hp.parity;
  return mode.hp.nonBoss;
}

/** Hard's 120% is stretch-only: authored teaching waves keep Normal HP. */
function modeForWave(mode: DifficultyMode, wave: WaveDef): DifficultyMode {
  if (mode.hpApplies !== 'procedural' || !('spawns' in wave)) return mode;
  return {
    ...mode,
    hp: {
      nonBoss: { ...mode.hp.nonBoss, mul: 100 },
      parity: { ...mode.hp.parity, mul: 100 },
      boss: mode.hp.boss,
    },
  };
}

function applyAuthored(
  wave: Extract<WaveDef, { spawns: unknown }>,
  mode: DifficultyMode,
  robots: GameData['robots'],
): WaveDef {
  return {
    id: wave.id,
    spawns: wave.spawns.map((spawn) => ({
      ...spawn,
      hp: scaleRange(spawn.hp, hpBandFor(spawn.robot, robots, mode)),
    })),
  };
}

function applyProcedural(
  wave: Extract<WaveDef, { procedural: unknown }>,
  mode: DifficultyMode,
  robots: GameData['robots'],
): WaveDef {
  const drop = new Set(mode.dropTemplates);
  return {
    id: wave.id,
    procedural: {
      groups: wave.procedural.groups.map((group) => {
        const pool = group.pool.filter((id) => !drop.has(id));
        if (pool.length === 0) {
          throw new Error(
            `applyDifficulty: dropping [${mode.dropTemplates.join(', ')}] emptied pool of "${wave.id}" turn ${group.turn}`,
          );
        }
        const hpByRobot = group.hpByRobot
          ? Object.fromEntries(
              Object.entries(group.hpByRobot)
                .filter(([id]) => pool.includes(id))
                .map(([id, range]) => [id, scaleRange(range, hpBandFor(id, robots, mode))]),
            )
          : undefined;
        const count = Math.min(
          pool.length,
          clamp(group.count + mode.countDelta, mode.minCount, mode.maxCount),
        );
        return {
          turn: group.turn,
          count,
          hp: scaleRange(group.hp, mode.hp.nonBoss),
          pool,
          ...(hpByRobot && Object.keys(hpByRobot).length > 0 ? { hpByRobot } : {}),
        };
      }),
    },
  };
}

/** Overlay a wave for one difficulty. Call before `rollWave`. Puzzle `loadLevel` never uses this. */
export function applyDifficulty(
  wave: WaveDef,
  difficulty: DifficultyId,
  data: GameData,
): WaveDef {
  const mode = modeForWave(data.difficulty.modes[difficulty], wave);
  if ('spawns' in wave) return applyAuthored(wave, mode, data.robots);
  return applyProcedural(wave, mode, data.robots);
}

/** `data.waves.waves[waveIndex]` after the run's difficulty overlay. */
export function waveForRun(
  data: GameData,
  waveIndex: number,
  difficulty: DifficultyId,
): WaveDef {
  const wave = data.waves.waves[waveIndex];
  if (!wave) {
    throw new Error(`waveForRun: no wave at index ${waveIndex} in waves.json`);
  }
  return applyDifficulty(wave, difficulty, data);
}

export function resolveDifficulty(difficulty: DifficultyId | undefined): DifficultyId {
  return difficulty ?? 'normal';
}
