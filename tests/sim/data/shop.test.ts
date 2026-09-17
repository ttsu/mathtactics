import { describe, expect, it } from 'vitest';
import { parseGameData } from '../../../sim/data/load';
import { loadRawGameData } from '../../helpers/loadDataFiles';
import { fakeDragSettings, fakeScreenSettings } from '../../helpers/dragSettings';
import {
  fakeDangerSettings,
  fakeHudSettings,
  fakePacingSettings,
  fakePlaybackSettings,
  fakeTraitSettings,
} from '../../helpers/playbackSettings';
import { fakeShop } from '../../helpers/shop';

function validTile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'add:1',
    kind: 'add',
    n: 1,
    priceCategory: 'add',
    color: 'green',
    starred: false,
    ...overrides,
  };
}

function allPriceTiles() {
  return [
    validTile(),
    validTile({ id: 'sub:1', kind: 'sub', n: 1, priceCategory: 'sub', color: 'blue' }),
    validTile({
      id: 'mul:2',
      kind: 'mul',
      n: 2,
      priceCategory: 'mulLow',
      color: 'orange',
    }),
    validTile({
      id: 'mul:6',
      kind: 'mul',
      n: 6,
      priceCategory: 'mulHigh',
      color: 'orange',
      starred: true,
    }),
  ];
}

function twoWaves() {
  return {
    waves: [
      { id: 'wave-1', spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [1, 1] }] },
      { id: 'wave-2', spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [1, 1] }] },
    ],
  };
}

function validRaw(overrides: Record<string, unknown> = {}) {
  return {
    tiles: allPriceTiles(),
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
    shop: fakeShop({
      shops: [
        {
          afterWave: 1,
          guarantees: [],
          table: [{ kind: 'add', n: [1, 1], weight: 1 }],
        },
      ],
    }),
    waves: twoWaves(),
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
    },
    ...overrides,
  };
}

describe('shop.json schema', () => {
  it('accepts extra future-wave tables while covering every non-final wave', () => {
    const data = parseGameData(
      validRaw({
        shop: fakeShop({
          shops: [
            {
              afterWave: 1,
              guarantees: [],
              table: [{ kind: 'add', n: [1, 1], weight: 1 }],
            },
            {
              afterWave: 6,
              guarantees: [],
              table: [{ kind: 'add', n: [1, 1], weight: 1 }],
            },
          ],
        }),
      }),
    );
    expect(data.shop.shops.map((shop) => shop.afterWave)).toEqual([1, 6]);
  });

  it('rejects a missing table for a wave that exists', () => {
    const raw = validRaw({
      shop: fakeShop({
        shops: [
          {
            afterWave: 2,
            guarantees: [],
            table: [{ kind: 'add', n: [1, 1], weight: 1 }],
          },
        ],
      }),
    });
    expect(() => parseGameData(raw)).toThrow(
      /^shop\.json: shops: missing table for afterWave 1/,
    );
  });

  it('rejects an unsatisfiable guarantee', () => {
    const raw = validRaw({
      shop: fakeShop({
        shops: [
          {
            afterWave: 1,
            guarantees: [{ kind: 'sub' }],
            table: [{ kind: 'add', n: [1, 1], weight: 1 }],
          },
        ],
      }),
    });
    expect(() => parseGameData(raw)).toThrow(/guarantee is not satisfiable/);
  });

  it('rejects an out-of-range n', () => {
    const raw = validRaw({
      shop: fakeShop({
        shops: [
          {
            afterWave: 1,
            guarantees: [],
            table: [{ kind: 'mul', n: [1, 3], weight: 1 }],
          },
        ],
      }),
    });
    expect(() => parseGameData(raw)).toThrow(/shop\.json:.*n must be 2-10/);
  });

  it('rejects a missing price category', () => {
    const raw = validRaw({
      shop: {
        ...fakeShop({
          shops: [
            {
              afterWave: 1,
              guarantees: [],
              table: [{ kind: 'add', n: [1, 1], weight: 1 }],
            },
          ],
        }),
        prices: { add: 4, sub: 4, mulLow: 6 },
      },
    });
    expect(() => parseGameData(raw)).toThrow(/^shop\.json: prices/);
  });

  it('rejects duplicate afterWave values', () => {
    const raw = validRaw({
      shop: fakeShop({
        shops: [
          {
            afterWave: 1,
            guarantees: [],
            table: [{ kind: 'add', n: [1, 1], weight: 1 }],
          },
          {
            afterWave: 1,
            guarantees: [],
            table: [{ kind: 'add', n: [1, 1], weight: 1 }],
          },
        ],
      }),
    });
    expect(() => parseGameData(raw)).toThrow(/duplicate afterWave 1/);
  });

  it('rejects shop: {}', () => {
    expect(() => parseGameData(validRaw({ shop: {} }))).toThrow(/^shop\.json:/);
  });
});

describe('shipped shop.json', () => {
  it('loads with nine afterWave tables', () => {
    const data = parseGameData(loadRawGameData());
    expect(data.shop.shops.map((shop) => shop.afterWave)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(data.shop.tileSlots).toBe(3);
  });
});
