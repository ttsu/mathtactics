import { describe, expect, it } from 'vitest';
import {
  BOSS_SPAWN_COL,
  SPAWN_COL,
  footprintIsFree,
  footprintLanes,
  reservedSpawnLanes,
  robotFootprint,
  robotOccupies,
  spawnColFor,
} from '../../sim/core/footprint';
import type { Robot } from '../../sim/core/types';

function robot(overrides: Partial<Robot> = {}): Robot {
  return {
    robotId: 'r1',
    lane: 1,
    col: 6,
    hp: 1000,
    maxHp: 1000,
    trait: { type: 'none' },
    isBoss: false,
    ...overrides,
  };
}

describe('robot footprint (2x2 Boss)', () => {
  it('a 1x1 occupies only its cell and spawns at col 7', () => {
    const basic = robot({ isBoss: false, lane: 2, col: 7 });
    expect(spawnColFor(false)).toBe(SPAWN_COL);
    expect(robotFootprint(basic)).toEqual([{ lane: 2, col: 7 }]);
    expect(robotOccupies(basic, { lane: 2, col: 7 })).toBe(true);
    expect(robotOccupies(basic, { lane: 2, col: 6 })).toBe(false);
    expect(footprintLanes(basic)).toEqual([2]);
    expect(reservedSpawnLanes(2, false)).toEqual([2]);
  });

  it('a Boss occupies a 2x2 from the top-front cell and spawns at col 6', () => {
    const boss = robot({ isBoss: true, lane: 1, col: 6 });
    expect(spawnColFor(true)).toBe(BOSS_SPAWN_COL);
    expect(robotFootprint(boss)).toEqual([
      { lane: 1, col: 6 },
      { lane: 1, col: 7 },
      { lane: 2, col: 6 },
      { lane: 2, col: 7 },
    ]);
    expect(robotOccupies(boss, { lane: 2, col: 7 })).toBe(true);
    expect(robotOccupies(boss, { lane: 1, col: 5 })).toBe(false);
    expect(footprintLanes(boss)).toEqual([1, 2]);
    expect(reservedSpawnLanes(1, true)).toEqual([1, 2]);
  });

  it('waiting robots occupy nothing', () => {
    expect(robotFootprint(robot({ col: null, isBoss: true }))).toEqual([]);
  });

  it('footprintIsFree rejects a 1x1 standing on the Boss back cell', () => {
    const boss = robot({ isBoss: true, lane: 1, col: 6 });
    const incoming = { lane: 2, col: 7, isBoss: false } as const;
    expect(footprintIsFree([boss], incoming)).toBe(false);
    expect(footprintIsFree([boss], { lane: 0, col: 7, isBoss: false })).toBe(true);
  });
});
