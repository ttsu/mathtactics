import { describe, expect, it } from 'vitest';
import { parseGameData } from '../../../sim/data/load';
import { WavesFileSchema } from '../../../sim/data/schemas';
import { loadRawGameData } from '../../helpers/loadDataFiles';
import { fakeDragSettings, fakeScreenSettings } from '../../helpers/dragSettings';
import { fakeShop } from '../../helpers/shop';
import { fakeDifficulty } from '../../helpers/difficulty';
import {
  fakeDangerSettings,
  fakeHintsSettings,
  fakeHudSettings,
  fakePacingSettings,
  fakePlaybackSettings,
  fakeTraitSettings,
  fakeBossSettings,
} from '../../helpers/playbackSettings';

function spawnDef(overrides: Record<string, unknown> = {}) {
  return { turn: 1, lane: 'A', robot: 'basic', hp: [1, 3], ...overrides };
}

function waveDef(overrides: Record<string, unknown> = {}) {
  return { id: 'wave-1', spawns: [spawnDef()], ...overrides };
}

function procGroup(overrides: Record<string, unknown> = {}) {
  return {
    turn: 1,
    count: 1,
    hp: [1, 3],
    pool: ['basic'],
    ...overrides,
  };
}

function procWave(overrides: Record<string, unknown> = {}) {
  return { id: 'wave-proc', procedural: { groups: [procGroup()] }, ...overrides };
}

const ALL_ROBOTS = [
  { id: 'basic', trait: { type: 'none' }, isBoss: false },
  { id: 'odd-only', trait: { type: 'oddOnly' }, isBoss: false },
  { id: 'bounce-back', trait: { type: 'bounceBack' }, isBoss: false },
];

function shopForWaves(waveCount: number) {
  return fakeShop({
    shops: Array.from({ length: Math.max(0, waveCount - 1) }, (_, i) => ({
      afterWave: i + 1,
      guarantees: [],
      table: [{ kind: 'add' as const, n: [1, 1] as [number, number], weight: 1 }],
    })),
  });
}

function validRaw(waves: unknown[], robots?: unknown[]) {
  return {
    tiles: [
      { id: 'add:1', kind: 'add', n: 1, priceCategory: 'add', color: 'green', starred: false },
    ],
    robots: robots ?? [{ id: 'basic', trait: { type: 'none' }, isBoss: false }],
    economy: {
      schemaVersion: 3,
      baseHp: 100,
      startCoins: 0,
      startCannonLane: 2,
      startBaseValue: 1,
      maxCannons: 5,
      income: { kill: 1, exactKill: 2, waveCleared: 3 },
    },
    shop: shopForWaves(waves.length),
    waves: { waves },
    difficulty: fakeDifficulty(),
    levels: { levels: [] },
    presentation: {
      pacing: fakePacingSettings(),
      playback: fakePlaybackSettings(),
      tileColors: { green: '#0f0', blue: '#00f', orange: '#f80' },
      drag: fakeDragSettings(),
      screens: fakeScreenSettings(),
      danger: fakeDangerSettings(),
      hud: fakeHudSettings(),
      traits: fakeTraitSettings(),
      boss: fakeBossSettings(),
      hints: fakeHintsSettings(),
    },
  };
}

describe('robots.json schema', () => {
  it('accepts a template and keeps its trait and Boss flag', () => {
    const data = parseGameData(
      validRaw([waveDef()], [{ id: 'basic', trait: { type: 'weakness', n: 5 }, isBoss: false }]),
    );
    expect(data.robots).toEqual([{ id: 'basic', trait: { type: 'weakness', n: 5 }, isBoss: false }]);
  });

  it('accepts an untraited Boss template', () => {
    const data = parseGameData(
      validRaw(
        [waveDef({ spawns: [spawnDef({ robot: 'boss', lane: 1, hp: [100, 150] })] })],
        [
          { id: 'basic', trait: { type: 'none' }, isBoss: false },
          { id: 'boss', trait: { type: 'none' }, isBoss: true },
        ],
      ),
    );
    expect(data.robots).toEqual([
      { id: 'basic', trait: { type: 'none' }, isBoss: false },
      { id: 'boss', trait: { type: 'none' }, isBoss: true },
    ]);
  });

  it('rejects a Boss whose trait is not none', () => {
    const raw = validRaw(
      [waveDef()],
      [
        { id: 'basic', trait: { type: 'none' }, isBoss: false },
        { id: 'boss', trait: { type: 'weakness', n: 5 }, isBoss: true },
      ],
    );
    expect(() => parseGameData(raw)).toThrow(/^robots\.json: \[1\]\.trait: Boss trait must be none/);
  });

  it('rejects an unknown trait', () => {
    const raw = validRaw([waveDef()], [{ id: 'basic', trait: { type: 'fast' }, isBoss: false }]);
    expect(() => parseGameData(raw)).toThrow(/^robots\.json: \[0\]\.trait/);
  });

  it('rejects duplicate robot ids', () => {
    const basic = { id: 'basic', trait: { type: 'none' }, isBoss: false };
    expect(() => parseGameData(validRaw([waveDef()], [basic, basic]))).toThrow(
      /^robots\.json: \[1\]\.id: duplicate/,
    );
  });
});

describe('waves.json schema', () => {
  it('accepts a wave with fixed lanes and letters before the last wave', () => {
    const data = parseGameData(
      validRaw([
        waveDef({
          spawns: [spawnDef({ lane: 'A' }), spawnDef({ turn: 3, lane: 4, hp: [5, 5] })],
        }),
        waveDef({ id: 'wave-2' }),
      ]),
    );
    const wave = data.waves.waves[0];
    expect(wave && 'spawns' in wave ? wave.spawns[1] : undefined).toEqual({
      turn: 3,
      lane: 4,
      robot: 'basic',
      hp: [5, 5],
    });
  });

  it('rejects an empty wave list', () => {
    expect(() => parseGameData(validRaw([]))).toThrow(/^waves\.json: waves:/);
  });

  it('rejects a bad lane token', () => {
    for (const lane of ['F', 'a', 5, -1]) {
      const raw = validRaw([waveDef({ spawns: [spawnDef({ lane })] })]);
      expect(() => parseGameData(raw)).toThrow(
        /^waves\.json: waves\[0\]\.spawns\[0\]\.lane: lane must be 0-4 or a letter A-E/,
      );
    }
  });

  it('rejects hp min greater than max', () => {
    const raw = validRaw([waveDef({ spawns: [spawnDef({ hp: [5, 4] })] })]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.spawns\[0\]\.hp: hp min 5 is greater than max 4/,
    );
  });

  it('rejects hp 0 and hp above the Boss maximum', () => {
    const zero = validRaw([waveDef({ spawns: [spawnDef({ hp: [0, 3] })] })]);
    expect(() => parseGameData(zero)).toThrow(/^waves\.json: waves\[0\]\.spawns\[0\]\.hp\[0\]:/);
    const tooHigh = validRaw([waveDef({ spawns: [spawnDef({ hp: [3, 1001] })] })]);
    expect(() => parseGameData(tooHigh)).toThrow(/^waves\.json: waves\[0\]\.spawns\[0\]\.hp\[1\]:/);
  });

  it('rejects a non-Boss spawn whose hp max exceeds 99 (cross-file)', () => {
    const raw = validRaw([waveDef({ spawns: [spawnDef({ hp: [100, 100] })] })]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.spawns\[0\]\.hp: hp max 100 exceeds 99 for non-Boss template "basic"/,
    );
  });

  it('loads a Boss spawn with hp [1000, 1000]', () => {
    const data = parseGameData(
      validRaw(
        [waveDef({ spawns: [spawnDef({ robot: 'boss', lane: 1, hp: [1000, 1000] })] })],
        [
          { id: 'basic', trait: { type: 'none' }, isBoss: false },
          { id: 'boss', trait: { type: 'none' }, isBoss: true },
        ],
      ),
    );
    const wave = data.waves.waves[0];
    expect(wave && 'spawns' in wave ? wave.spawns[0] : undefined).toEqual({
      turn: 1,
      lane: 1,
      robot: 'boss',
      hp: [1000, 1000],
    });
  });

  it('rejects a Boss spawn on lane 4 (2x2 does not fit)', () => {
    const raw = validRaw(
      [waveDef({ spawns: [spawnDef({ robot: 'boss', lane: 4, hp: [1000, 1000] })] })],
      [
        { id: 'basic', trait: { type: 'none' }, isBoss: false },
        { id: 'boss', trait: { type: 'none' }, isBoss: true },
      ],
    );
    expect(() => parseGameData(raw)).toThrow(/Boss 2x2 does not fit on lane 4/);
  });

  it('rejects a Boss spawn with a letter lane', () => {
    const raw = validRaw(
      [waveDef({ spawns: [spawnDef({ robot: 'boss', lane: 'A', hp: [1000, 1000] })] })],
      [
        { id: 'basic', trait: { type: 'none' }, isBoss: false },
        { id: 'boss', trait: { type: 'none' }, isBoss: true },
      ],
    );
    expect(() => parseGameData(raw)).toThrow(/Boss must use a fixed lane/);
  });

  it('rejects a Boss spawn whose hp max exceeds 1000', () => {
    const raw = validRaw(
      [waveDef({ spawns: [spawnDef({ robot: 'boss', lane: 1, hp: [1001, 1001] })] })],
      [
        { id: 'basic', trait: { type: 'none' }, isBoss: false },
        { id: 'boss', trait: { type: 'none' }, isBoss: true },
      ],
    );
    expect(() => parseGameData(raw)).toThrow(/hp/);
  });

  it('rejects a basic spawn with hp [100, 120] even though the per-spawn ceiling is 1000', () => {
    const raw = validRaw([waveDef({ spawns: [spawnDef({ hp: [100, 120] })] })]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.spawns\[0\]\.hp: hp max 120 exceeds 99 for non-Boss template "basic"/,
    );
  });

  it('rejects a wave with no spawns', () => {
    const raw = validRaw([waveDef({ spawns: [] })]);
    expect(() => parseGameData(raw)).toThrow(/^waves\.json: waves\[0\]\.spawns:/);
  });

  it('rejects a wave with no turn-1 spawn', () => {
    const raw = validRaw([waveDef({ spawns: [spawnDef({ turn: 2 })] })]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.spawns: a wave needs a spawn on turn 1/,
    );
  });

  it('rejects an unknown robot id', () => {
    const raw = validRaw([waveDef({ spawns: [spawnDef(), spawnDef({ robot: 'tank' })] })]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.spawns\[1\]\.robot: unknown robot id "tank"/,
    );
  });

  it('rejects a reward key (wave rewards were removed in M3)', () => {
    const raw = validRaw([
      waveDef({ reward: { tiles: ['add:1'] } }),
      waveDef({ id: 'wave-2' }),
    ]);
    expect(() => parseGameData(raw)).toThrow(/^waves\.json: waves\[0\]:/);
  });

  it('rejects more lane letters than lanes not fixed in the wave', () => {
    const spawns = [
      spawnDef({ lane: 0 }),
      spawnDef({ lane: 1 }),
      spawnDef({ lane: 'A' }),
      spawnDef({ lane: 'B' }),
      spawnDef({ lane: 'C' }),
      spawnDef({ lane: 'D' }),
    ];
    const raw = validRaw([waveDef({ spawns })]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.spawns: 4 lane letters but only 3 lanes are not fixed/,
    );
  });

  it('allows as many letters as free lanes, counting a repeated fixed lane once', () => {
    const spawns = [
      spawnDef({ lane: 0 }),
      spawnDef({ lane: 0, turn: 2 }),
      spawnDef({ lane: 'A' }),
      spawnDef({ lane: 'B' }),
      spawnDef({ lane: 'C' }),
      spawnDef({ lane: 'D' }),
    ];
    expect(() => parseGameData(validRaw([waveDef({ spawns })]))).not.toThrow();
  });

  it('rejects duplicate wave ids', () => {
    const raw = validRaw([waveDef(), waveDef()]);
    expect(() => parseGameData(raw)).toThrow(/^waves\.json: waves\[1\]\.id: duplicate wave id/);
  });

  it('rejects an unknown key, so a typo is not silently ignored', () => {
    const raw = validRaw([waveDef({ rewards: { tiles: [] } })]);
    expect(() => parseGameData(raw)).toThrow(/^waves\.json: waves\[0\]:/);
  });

  it('accepts a procedural wave', () => {
    const data = parseGameData(
      validRaw(
        [
          procWave({
            procedural: {
              groups: [
                procGroup({ count: 2, hp: [4, 8], pool: ['basic', 'odd-only'] }),
                procGroup({ turn: 6, count: 1, hp: [9, 9], pool: ['bounce-back'] }),
              ],
            },
          }),
        ],
        ALL_ROBOTS,
      ),
    );
    const wave = data.waves.waves[0];
    expect(wave && 'procedural' in wave ? wave.procedural : undefined).toEqual({
      groups: [
        { turn: 1, count: 2, hp: [4, 8], pool: ['basic', 'odd-only'] },
        { turn: 6, count: 1, hp: [9, 9], pool: ['bounce-back'] },
      ],
    });
  });

  it('rejects a wave with both spawns and procedural', () => {
    const raw = validRaw([
      { id: 'wave-1', spawns: [spawnDef()], procedural: { groups: [procGroup()] } },
    ]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]: a wave cannot have both spawns and procedural/,
    );
  });

  it('rejects count greater than pool.length', () => {
    const raw = validRaw([
      procWave({ procedural: { groups: [procGroup({ count: 2, pool: ['basic'] })] } }),
    ]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.procedural\.groups\[0\]\.count: count 2 exceeds pool.length 1/,
    );
  });

  it('rejects duplicate pool ids', () => {
    const raw = validRaw([
      procWave({
        procedural: { groups: [procGroup({ pool: ['basic', 'basic'] })] },
      }),
    ]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.procedural\.groups\[0\]\.pool\[1\]: duplicate pool id "basic"/,
    );
  });

  it('rejects an unknown pool id', () => {
    const raw = validRaw([procWave({ procedural: { groups: [procGroup({ pool: ['tank'] })] } })]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.procedural\.groups\[0\]\.pool\[0\]: unknown robot id "tank"/,
    );
  });

  it('accepts hpByRobot overrides for ids in the pool', () => {
    const data = parseGameData(
      validRaw(
        [
          procWave({
            procedural: {
              groups: [
                procGroup({
                  count: 2,
                  hp: [40, 50],
                  pool: ['basic', 'odd-only'],
                  hpByRobot: { 'odd-only': [18, 26] },
                }),
              ],
            },
          }),
        ],
        ALL_ROBOTS,
      ),
    );
    const wave = data.waves.waves[0];
    expect(wave && 'procedural' in wave ? wave.procedural.groups[0] : undefined).toEqual({
      turn: 1,
      count: 2,
      hp: [40, 50],
      pool: ['basic', 'odd-only'],
      hpByRobot: { 'odd-only': [18, 26] },
    });
  });

  it('rejects an hpByRobot key that is not in the pool', () => {
    const raw = validRaw(
      [
        procWave({
          procedural: {
            groups: [
              procGroup({
                pool: ['basic'],
                hpByRobot: { 'odd-only': [18, 26] },
              }),
            ],
          },
        }),
      ],
      ALL_ROBOTS,
    );
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.procedural\.groups\[0\]\.hpByRobot\.odd-only: hpByRobot key "odd-only" is not in this group's pool/,
    );
  });

  it('rejects a procedural group whose hp exceeds 99', () => {
    const raw = validRaw([
      procWave({ procedural: { groups: [procGroup({ hp: [100, 100] })] } }),
    ]);
    expect(() => parseGameData(raw)).toThrow(/^waves\.json: waves\[0\]\.procedural\.groups\[0\]\.hp/);
  });

  it('rejects a Boss template in a procedural pool', () => {
    const raw = validRaw(
      [procWave({ procedural: { groups: [procGroup({ pool: ['titan'] })] } })],
      [
        { id: 'basic', trait: { type: 'none' }, isBoss: false },
        { id: 'titan', trait: { type: 'none' }, isBoss: true },
      ],
    );
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.procedural\.groups\[0\]\.pool\[0\]: pool may not name a Boss template "titan"/,
    );
  });

  it('rejects the shipped boss id in a procedural pool', () => {
    const raw = validRaw(
      [procWave({ procedural: { groups: [procGroup({ pool: ['boss'] })] } })],
      [
        { id: 'basic', trait: { type: 'none' }, isBoss: false },
        { id: 'boss', trait: { type: 'none' }, isBoss: true },
      ],
    );
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.procedural\.groups\[0\]\.pool\[0\]: pool may not name a Boss template "boss"/,
    );
  });

  it('WavesFileSchema standalone (scenario waves:) allows 150 HP on a non-Boss id', () => {
    const parsed = WavesFileSchema.safeParse({
      waves: [{ id: 's', spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [150, 150] }] }],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a procedural wave with no turn-1 group', () => {
    const raw = validRaw([procWave({ procedural: { groups: [procGroup({ turn: 2 })] } })]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.procedural\.groups: a wave needs a group on turn 1/,
    );
  });

  it('rejects duplicate group turns', () => {
    const raw = validRaw([
      procWave({
        procedural: {
          groups: [procGroup(), procGroup({ hp: [2, 2] })],
        },
      }),
    ]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.procedural\.groups\[1\]\.turn: duplicate turn 1/,
    );
  });
});

describe('draft ladder content (task 12 / 21 / 22 / 25 / 26)', () => {
  it('ships the eight robot templates and waves 1-10', () => {
    const data = parseGameData(loadRawGameData());
    expect(data.robots).toEqual([
      { id: 'basic', trait: { type: 'none' }, isBoss: false },
      { id: 'weakness-2', trait: { type: 'weakness', n: 2 }, isBoss: false },
      { id: 'weakness-5', trait: { type: 'weakness', n: 5 }, isBoss: false },
      { id: 'weakness-10', trait: { type: 'weakness', n: 10 }, isBoss: false },
      { id: 'bounce-back', trait: { type: 'bounceBack' }, isBoss: false },
      { id: 'odd-only', trait: { type: 'oddOnly' }, isBoss: false },
      { id: 'even-only', trait: { type: 'evenOnly' }, isBoss: false },
      { id: 'boss', trait: { type: 'none' }, isBoss: true },
    ]);
    expect(data.waves.waves.map((wave) => wave.id)).toEqual([
      'wave-1',
      'wave-2',
      'wave-3',
      'wave-4',
      'wave-5',
      'wave-6',
      'wave-7',
      'wave-8',
      'wave-9',
      'wave-10',
    ]);
    expect(data.waves.waves.every((wave) => !('reward' in wave))).toBe(true);
    expect('spawns' in data.waves.waves[6]!).toBe(true);
    expect('procedural' in data.waves.waves[7]!).toBe(true);
    expect('procedural' in data.waves.waves[8]!).toBe(true);
    expect('spawns' in data.waves.waves[9]!).toBe(true);
  });
});
