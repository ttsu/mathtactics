import { describe, expect, it } from 'vitest';
import { parseGameData } from '../../../sim/data/load';
import { loadRawGameData } from '../../helpers/loadDataFiles';
import { fakeDragSettings, fakeScreenSettings } from '../../helpers/dragSettings';
import { fakeShop } from '../../helpers/shop';
import {
  fakeDangerSettings,
  fakePacingSettings,
  fakePlaybackSettings,
} from '../../helpers/playbackSettings';

function spawnDef(overrides: Record<string, unknown> = {}) {
  return { turn: 1, lane: 'A', robot: 'basic', hp: [1, 3], ...overrides };
}

function waveDef(overrides: Record<string, unknown> = {}) {
  return { id: 'wave-1', spawns: [spawnDef()], ...overrides };
}

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
      schemaVersion: 2,
      baseHp: 100,
      startCoins: 0,
      startCannonLane: 2,
      startBaseValue: 1,
      maxCannons: 5,
      income: { kill: 1, exactKill: 2, waveCleared: 3 },
    },
    shop: shopForWaves(waves.length),
    waves: { waves },
    levels: { levels: [] },
    presentation: {
      pacing: fakePacingSettings(),
      playback: fakePlaybackSettings(),
      tileColors: { green: '#0f0', blue: '#00f', orange: '#f80' },
      drag: fakeDragSettings(),
      screens: fakeScreenSettings(),
      danger: fakeDangerSettings(),
    },
  };
}

describe('robots.json schema', () => {
  it('accepts a template and keeps its trait and Boss flag', () => {
    const data = parseGameData(
      validRaw([waveDef()], [{ id: 'basic', trait: { type: 'weakness', n: 5 }, isBoss: true }]),
    );
    expect(data.robots).toEqual([{ id: 'basic', trait: { type: 'weakness', n: 5 }, isBoss: true }]);
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
  it('accepts a wave with fixed lanes, letters and a reward before the last wave', () => {
    const data = parseGameData(
      validRaw([
        waveDef({
          spawns: [spawnDef({ lane: 'A' }), spawnDef({ turn: 3, lane: 4, hp: [5, 5] })],
          reward: { tiles: ['add:1'] },
        }),
        waveDef({ id: 'wave-2' }),
      ]),
    );
    expect(data.waves.waves[0]?.spawns[1]).toEqual({
      turn: 3,
      lane: 4,
      robot: 'basic',
      hp: [5, 5],
    });
    expect(data.waves.waves[0]?.reward).toEqual({ tiles: ['add:1'] });
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

  it('rejects hp 0 and hp 100', () => {
    const zero = validRaw([waveDef({ spawns: [spawnDef({ hp: [0, 3] })] })]);
    expect(() => parseGameData(zero)).toThrow(/^waves\.json: waves\[0\]\.spawns\[0\]\.hp\[0\]:/);
    const hundred = validRaw([waveDef({ spawns: [spawnDef({ hp: [3, 100] })] })]);
    expect(() => parseGameData(hundred)).toThrow(/^waves\.json: waves\[0\]\.spawns\[0\]\.hp\[1\]:/);
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

  it('rejects an unknown reward tile id', () => {
    const raw = validRaw([
      waveDef({ reward: { tiles: ['add:1', 'mul:7'] } }),
      waveDef({ id: 'wave-2' }),
    ]);
    expect(() => parseGameData(raw)).toThrow(
      /^waves\.json: waves\[0\]\.reward\.tiles\[1\]: unknown tile id "mul:7"/,
    );
  });

  it('rejects a reward on the last wave', () => {
    const raw = validRaw([waveDef(), waveDef({ id: 'wave-2', reward: { tiles: ['add:1'] } })]);
    expect(() => parseGameData(raw)).toThrow(/^waves\.json: waves\[1\]\.reward: the last wave/);
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
});

describe('draft ladder content (task 12)', () => {
  it('ships the basic robot and waves 1-3', () => {
    const data = parseGameData(loadRawGameData());
    expect(data.robots).toEqual([{ id: 'basic', trait: { type: 'none' }, isBoss: false }]);
    expect(data.waves.waves.map((wave) => wave.id)).toEqual(['wave-1', 'wave-2', 'wave-3']);
    expect(data.waves.waves[0]?.reward?.tiles).toEqual(['add:1', 'add:2', 'add:3']);
    expect(data.waves.waves[1]?.reward?.tiles).toEqual(['mul:2', 'add:4']);
    expect(data.waves.waves[2]?.reward).toBeUndefined();
  });
});
