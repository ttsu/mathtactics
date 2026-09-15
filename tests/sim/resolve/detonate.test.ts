// DETONATE unit tests (GDD §4 step 4, §7.2, TR §6).

import { describe, expect, it } from 'vitest';
import { detonate } from '../../../sim/resolve/detonate';
import type { Robot } from '../../../sim/core/types';

function robot(overrides: Partial<Robot> = {}): Robot {
  return {
    robotId: 'robot:0',
    lane: 0,
    col: null,
    hp: 8,
    maxHp: 8,
    trait: { type: 'none' },
    isBoss: false,
    ...overrides,
  };
}

describe('detonate — resolving queued detonations (GDD §7.2)', () => {
  it('deals damage equal to remaining HP and removes it from baseHp (not clamped)', () => {
    const result = detonate([robot({ hp: 8 })], 10, 0);

    expect(result.baseHp).toBe(2);
    expect(result.events).toEqual([
      {
        step: 0,
        group: 'detonate:0',
        type: 'RobotDetonated',
        robotId: 'robot:0',
        lane: 0,
        damage: 8,
      },
      {
        step: 1,
        group: 'detonate:0',
        type: 'BaseDamaged',
        amount: 8,
        hpBefore: 10,
        hpAfter: 2,
      },
    ]);
  });

  it('does not clamp baseHp at 0 — chip damage lets a worn-down robot detonate for the remainder', () => {
    const result = detonate([robot({ hp: 30 })], 10, 0);
    expect(result.baseHp).toBe(-20);
  });

  it('resolves multiple detonations in lane order, regardless of input order', () => {
    const result = detonate(
      [
        robot({ robotId: 'robot:hi', lane: 3, hp: 5 }),
        robot({ robotId: 'robot:lo', lane: 0, hp: 4 }),
      ],
      100,
      0,
    );

    const detonated = result.events.filter((e) => e.type === 'RobotDetonated');
    expect(detonated.map((e) => (e as { robotId: string }).robotId)).toEqual([
      'robot:lo',
      'robot:hi',
    ]);
    expect(result.baseHp).toBe(91);
    const groups = result.events.map((e) => e.group);
    expect(groups).toEqual(['detonate:0', 'detonate:0', 'detonate:3', 'detonate:3']);
  });

  it('continues `step` from `firstStep`', () => {
    const result = detonate([robot()], 100, 5);
    expect(result.events.map((e) => e.step)).toEqual([5, 6]);
  });

  it('is a no-op with no queued detonations', () => {
    const result = detonate([], 50, 3);
    expect(result.baseHp).toBe(50);
    expect(result.events).toEqual([]);
  });
});
