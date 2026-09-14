import { describe, expect, it } from 'vitest';
import { parseGameData } from '../../../sim/data/load';
import { applyTile } from '../../../sim/core/tiles';
import type { TileDef } from '../../../sim/core/types';
import { loadRawGameData } from '../../helpers/loadDataFiles';

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
    robots: [],
    economy: {
      schemaVersion: 1,
      baseHp: 100,
      startCoins: 0,
      startCannonLane: 2,
      startBaseValue: 1,
      maxCannons: 5,
      income: { kill: 1, exactKill: 2, waveCleared: 3 },
    },
    shop: {},
    waves: { waves: [] },
    levels: { levels: [] },
    presentation: {
      pacing: {
        ballCellDurationMs: 200,
        perTilePauseMs: 100,
        laneGapMs: 300,
        advanceDurationMs: 400,
      },
      tileColors: { green: '#4caf50', blue: '#2196f3', orange: '#ff9800' },
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
      schemaVersion: 1,
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
