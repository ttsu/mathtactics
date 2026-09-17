import { describe, expect, it } from 'vitest';
import { parseGameData } from '../../../sim/data/load';
import { applyTile } from '../../../sim/core/tiles';
import type { TileDef } from '../../../sim/core/types';
import { loadRawGameData } from '../../helpers/loadDataFiles';
import { fakeDragSettings, fakeScreenSettings } from '../../helpers/dragSettings';
import { fakeShop } from '../../helpers/shop';
import {
  fakeBossSettings,
  fakeDangerSettings,
  fakeHintsSettings,
  fakeHudSettings,
  fakePacingSettings,
  fakePlaybackSettings,
  fakeTraitSettings,
} from '../../helpers/playbackSettings';

function validTile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'add:5',
    kind: 'add',
    n: 5,
    priceCategory: 'add',
    color: 'green',
    starred: false,
    ...overrides,
  };
}

function validRaw(overrides: Record<string, unknown> = {}) {
  return {
    tiles: [validTile()],
    robots: [{ id: 'basic', trait: { type: 'none' }, isBoss: false }],
    economy: {
      schemaVersion: 1,
      baseHp: 100,
      startCoins: 0,
      startCannonLane: 2,
      startBaseValue: 1,
      maxCannons: 5,
      income: { kill: 1, exactKill: 2, waveCleared: 3 },
    },
    shop: fakeShop(),
    waves: {
      waves: [{ id: 'wave-1', spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [1, 1] }] }],
    },
    levels: { levels: [] },
    presentation: {
      pacing: fakePacingSettings(),
      playback: fakePlaybackSettings(),
      tileColors: { green: '#4caf50', blue: '#2196f3', orange: '#ff9800' },
      drag: fakeDragSettings(),
      screens: fakeScreenSettings(),
      danger: fakeDangerSettings(),
      hud: fakeHudSettings(),
      traits: fakeTraitSettings(),
      boss: fakeBossSettings(),
      hints: fakeHintsSettings(),
    },
    ...overrides,
  };
}

describe('parseGameData', () => {
  it('accepts a well-formed combined data object', () => {
    const data = parseGameData(validRaw());
    expect(data.tiles).toHaveLength(1);
    expect(data.economy.baseHp).toBe(100);
  });

  it('rejects a malformed tile with a readable message naming the file and path', () => {
    const raw = validRaw({
      tiles: [validTile(), validTile({ id: 'add:6', n: 6 }), validTile(), { n: 'oops' }],
    });
    expect(() => parseGameData(raw)).toThrow(/^tiles\.json: \[3\]\./);
  });

  it('rejects a tile whose id does not match kind:n', () => {
    const raw = validRaw({ tiles: [validTile({ id: 'add:99' })] });
    expect(() => parseGameData(raw)).toThrow(/tiles\.json: \[0\]\.id/);
  });

  it('rejects a tile with an out-of-range n', () => {
    const raw = validRaw({
      tiles: [validTile({ id: 'mul:12', kind: 'mul', n: 12, priceCategory: 'mulHigh' })],
    });
    expect(() => parseGameData(raw)).toThrow(/tiles\.json: \[0\]\.n/);
  });

  it('rejects a tile with an inconsistent priceCategory', () => {
    const raw = validRaw({
      tiles: [
        validTile({ id: 'mul:7', kind: 'mul', n: 7, priceCategory: 'mulLow', color: 'orange' }),
      ],
    });
    expect(() => parseGameData(raw)).toThrow(/tiles\.json: \[0\]\.priceCategory/);
  });

  it('rejects duplicate tile ids', () => {
    const raw = validRaw({ tiles: [validTile(), validTile()] });
    expect(() => parseGameData(raw)).toThrow(/tiles\.json: \[1\]\.id: duplicate/);
  });

  it('names the file and path for a malformed economy field', () => {
    const raw = validRaw({
      economy: {
        schemaVersion: 1,
        baseHp: -5,
        startCoins: 0,
        startCannonLane: 2,
        startBaseValue: 1,
        maxCannons: 5,
        income: { kill: 1, exactKill: 2, waveCleared: 3 },
      },
    });
    expect(() => parseGameData(raw)).toThrow(/^economy\.json: baseHp:/);
  });
});

describe('parseGameData on the real /data directory', () => {
  it('loads successfully', () => {
    const raw = loadRawGameData();
    const data = parseGameData(raw);
    expect(data.tiles.length).toBeGreaterThan(0);
  });

  it('has all 29 v1 tiles (GDD §9.1)', () => {
    const data = parseGameData(loadRawGameData());
    expect(data.tiles).toHaveLength(29);
    const ids = new Set(data.tiles.map((t) => t.id));
    for (let n = 1; n <= 10; n += 1) {
      expect(ids.has(`add:${n}`)).toBe(true);
      expect(ids.has(`sub:${n}`)).toBe(true);
    }
    for (let n = 2; n <= 10; n += 1) {
      expect(ids.has(`mul:${n}`)).toBe(true);
    }
  });

  it('matches the economy values from the task spec', () => {
    const data = parseGameData(loadRawGameData());
    expect(data.economy).toMatchObject({
      schemaVersion: 3,
      baseHp: 100,
      startCoins: 0,
      startCannonLane: 2,
      startBaseValue: 1,
      maxCannons: 5,
      income: { kill: 1, exactKill: 2, waveCleared: 3 },
    });
  });

  // Type-level guard for the schema-inferred `id: TileId` narrowing (not just `string`) — this
  // assignment and `applyTile` call must *typecheck* (TS2345 if the narrowing regresses), not
  // just run. See sim/data/schemas.ts's TileDefSchema `.transform`.
  it('a loaded tile satisfies TileDef and can be passed to applyTile', () => {
    const data = parseGameData(loadRawGameData());
    const tile: TileDef = data.tiles[0]!;
    expect(applyTile(5, tile)).toBeTypeOf('number');
  });
});

describe('presentation.json drag settings (task 09)', () => {
  it('rejects a snap radius under 0.6 cell', () => {
    const raw = validRaw();
    const presentation = raw.presentation as { drag: Record<string, number> };
    presentation.drag.snapRadiusCells = 0.5;
    expect(() => parseGameData(raw)).toThrow(/presentation\.json/);
  });
});

describe('presentation.json hud Go nudge', () => {
  it('rejects a missing idle delay', () => {
    const raw = validRaw();
    const presentation = raw.presentation as { hud: Record<string, unknown> };
    delete presentation.hud.goNudgeIdleMs;
    expect(() => parseGameData(raw)).toThrow(/presentation\.json/);
  });

  it('ships a 10s idle before the Go wiggle', () => {
    const data = parseGameData(loadRawGameData());
    expect(data.presentation.hud.goNudgeIdleMs).toBe(10000);
    expect(data.presentation.hud.goColor).toMatch(/^#/);
  });
});

describe('presentation.json traits (task 23)', () => {
  it('ships telegraph colours with locked keys', () => {
    const data = parseGameData(loadRawGameData());
    expect(data.presentation.traits).toEqual(fakeTraitSettings());
  });

  it('rejects a missing trait colour key', () => {
    const raw = validRaw();
    const presentation = raw.presentation as { traits: Record<string, unknown> };
    delete presentation.traits.oddShieldColor;
    expect(() => parseGameData(raw)).toThrow(/presentation.json/);
  });
});

describe('presentation.json boss (task 26)', () => {
  it('ships the overflow scale', () => {
    const data = parseGameData(loadRawGameData());
    expect(data.presentation.boss).toEqual(fakeBossSettings());
  });

  it('rejects a missing boss scale', () => {
    const raw = validRaw();
    const presentation = raw.presentation as { boss?: unknown };
    delete presentation.boss;
    expect(() => parseGameData(raw)).toThrow(/presentation.json/);
  });
});

describe('presentation.json planning hints (task 24)', () => {
  it('rejects a missing hint colour', () => {
    const raw = validRaw();
    const presentation = raw.presentation as { hints?: { color: string } };
    delete presentation.hints;
    expect(() => parseGameData(raw)).toThrow(/presentation.json/);
  });

  it('ships a hint colour', () => {
    const data = parseGameData(loadRawGameData());
    expect(data.presentation.hints.color).toMatch(/^#/);
  });
});
