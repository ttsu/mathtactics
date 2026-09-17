import { describe, expect, it } from 'vitest';
import { parseGameData } from '../../../sim/data/load';
import { fakeDragSettings, fakeScreenSettings } from '../../helpers/dragSettings';
import { fakeShop } from '../../helpers/shop';
import {
  fakeDangerSettings,
  fakeHintsSettings,
  fakeHudSettings,
  fakePacingSettings,
  fakePlaybackSettings,
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
      hints: fakeHintsSettings(),
    },
    ...overrides,
  };
}

function validLevel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'level-1',
    cannonLanes: [0],
    baseValue: 1,
    boardTiles: [],
    tray: [],
    robots: [{ lane: 0, col: 7, hp: 1 }],
    ...overrides,
  };
}

describe('levels.json schema', () => {
  it('accepts a minimal, well-formed level and defaults trait to none', () => {
    const data = parseGameData(validRaw({ levels: { levels: [validLevel()] } }));
    expect(data.levels.levels).toHaveLength(1);
    expect(data.levels.levels[0]?.robots[0]?.trait).toEqual({ type: 'none' });
  });

  it('accepts a level with pre-placed board tiles, a tray, and multiple cannons', () => {
    const level = validLevel({
      cannonLanes: [0, 2],
      boardTiles: [{ lane: 0, col: 3, tileId: 'add:5' }],
      tray: ['add:5', 'mul:3'],
      robots: [
        { lane: 0, col: 7, hp: 3 },
        { lane: 2, col: 6, hp: 5, trait: { type: 'oddOnly' } },
      ],
    });
    const data = parseGameData(validRaw({ levels: { levels: [level] } }));
    expect(data.levels.levels[0]?.cannonLanes).toEqual([0, 2]);
    expect(data.levels.levels[0]?.boardTiles).toEqual([{ lane: 0, col: 3, tileId: 'add:5' }]);
    expect(data.levels.levels[0]?.robots[1]?.trait).toEqual({ type: 'oddOnly' });
  });

  it('accepts every trait shape', () => {
    const traits = [
      { type: 'none' },
      { type: 'weakness', n: 2 },
      { type: 'weakness', n: 5 },
      { type: 'weakness', n: 10 },
      { type: 'bounceBack' },
      { type: 'oddOnly' },
      { type: 'evenOnly' },
    ];
    for (const trait of traits) {
      const data = parseGameData(
        validRaw({
          levels: { levels: [validLevel({ robots: [{ lane: 0, col: 7, hp: 1, trait }] })] },
        }),
      );
      expect(data.levels.levels[0]?.robots[0]?.trait).toEqual(trait);
    }
  });

  it('rejects an unknown trait weakness n', () => {
    const raw = validRaw({
      levels: {
        levels: [
          validLevel({ robots: [{ lane: 0, col: 7, hp: 1, trait: { type: 'weakness', n: 3 } }] }),
        ],
      },
    });
    expect(() => parseGameData(raw)).toThrow(/levels\.json/);
  });

  it('rejects a tile id that is not kind:n shaped', () => {
    const raw = validRaw({ levels: { levels: [validLevel({ tray: ['not-a-tile-id'] })] } });
    expect(() => parseGameData(raw)).toThrow(/levels\.json.*tray/);
  });

  it('rejects a robot column of 0 (the cannon slot)', () => {
    const raw = validRaw({
      levels: { levels: [validLevel({ robots: [{ lane: 0, col: 0, hp: 1 }] })] },
    });
    expect(() => parseGameData(raw)).toThrow(/levels\.json/);
  });

  it('rejects a lane outside 0-4', () => {
    const raw = validRaw({ levels: { levels: [validLevel({ cannonLanes: [5] })] } });
    expect(() => parseGameData(raw)).toThrow(/levels\.json/);
  });

  it('rejects duplicate cannon lanes', () => {
    const raw = validRaw({ levels: { levels: [validLevel({ cannonLanes: [0, 0] })] } });
    expect(() => parseGameData(raw)).toThrow(/duplicate cannon lane/);
  });

  it('rejects two board tiles at the same cell', () => {
    const raw = validRaw({
      levels: {
        levels: [
          validLevel({
            boardTiles: [
              { lane: 0, col: 3, tileId: 'add:5' },
              { lane: 0, col: 3, tileId: 'add:5' },
            ],
          }),
        ],
      },
    });
    expect(() => parseGameData(raw)).toThrow(/duplicate tile placement/);
  });

  it('rejects duplicate level ids', () => {
    const raw = validRaw({
      levels: { levels: [validLevel({ id: 'dup' }), validLevel({ id: 'dup' })] },
    });
    expect(() => parseGameData(raw)).toThrow(/duplicate level id/);
  });
});
