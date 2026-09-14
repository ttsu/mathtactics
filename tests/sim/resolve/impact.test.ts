// resolveImpact (GDD §5.4, §6.2-6.5) — the full impact table, trait by trait.

import { describe, expect, it } from 'vitest';
import { resolveImpact } from '../../../sim/resolve/impact';
import type { Robot, Trait } from '../../../sim/core/types';

function fakeRobot(hp: number, maxHp: number, trait: Trait): Robot {
  return { robotId: 'robot:0', lane: 0, col: 5, hp, maxHp, trait, isBoss: false };
}

const NONE: Trait = { type: 'none' };

describe('resolveImpact — no trait', () => {
  it('under: survives, damage carries', () => {
    const outcome = resolveImpact(fakeRobot(10, 10, NONE), 7);
    expect(outcome).toEqual({
      kind: 'damaged',
      damage: 7,
      doubled: false,
      hpBefore: 10,
      hpAfter: 3,
      result: 'survive',
      bounceBack: null,
    });
  });

  it('exact: reduces to exactly 0', () => {
    const outcome = resolveImpact(fakeRobot(10, 10, NONE), 10);
    expect(outcome).toMatchObject({ hpAfter: 0, result: 'exact' });
  });

  it('over: kills, hp goes negative', () => {
    const outcome = resolveImpact(fakeRobot(10, 10, NONE), 13);
    expect(outcome).toMatchObject({ damage: 13, hpAfter: -3, result: 'kill' });
  });

  it('value 0 deals 0 damage and survives', () => {
    const outcome = resolveImpact(fakeRobot(10, 10, NONE), 0);
    expect(outcome).toMatchObject({ damage: 0, hpAfter: 10, result: 'survive' });
  });

  it('negative value deals 0 damage', () => {
    const outcome = resolveImpact(fakeRobot(10, 10, NONE), -5);
    expect(outcome).toMatchObject({ damage: 0, hpAfter: 10, result: 'survive' });
  });
});

describe('resolveImpact — Bounce-back (GDD §6.2)', () => {
  const BOUNCE: Trait = { type: 'bounceBack' };

  it('10 HP hit for 7 -> 3 (short), no RobotBouncedBack', () => {
    const outcome = resolveImpact(fakeRobot(10, 10, BOUNCE), 7);
    expect(outcome).toMatchObject({ hpAfter: 3, result: 'survive', bounceBack: null });
  });

  it('10 HP hit for 10 -> exact kill, no RobotBouncedBack', () => {
    const outcome = resolveImpact(fakeRobot(10, 10, BOUNCE), 10);
    expect(outcome).toMatchObject({ hpAfter: 0, result: 'exact', bounceBack: null });
  });

  it('10 HP hit for 13 -> 3 (over), overshoot 3', () => {
    const outcome = resolveImpact(fakeRobot(10, 10, BOUNCE), 13);
    expect(outcome).toMatchObject({
      hpAfter: 3,
      result: 'survive',
      bounceBack: { overshoot: 3 },
    });
  });

  it('10 HP hit for 25 -> 10, capped at maxHp, overshoot 15', () => {
    const outcome = resolveImpact(fakeRobot(10, 10, BOUNCE), 25);
    expect(outcome).toMatchObject({
      hpAfter: 10,
      result: 'survive',
      bounceBack: { overshoot: 15 },
    });
  });

  it('0 damage leaves HP unchanged, no RobotBouncedBack', () => {
    const outcome = resolveImpact(fakeRobot(10, 10, BOUNCE), 0);
    expect(outcome).toMatchObject({ damage: 0, hpAfter: 10, result: 'survive', bounceBack: null });
  });

  it('never produces a kill (hpAfter is never negative)', () => {
    const outcome = resolveImpact(fakeRobot(10, 10, BOUNCE), 999);
    if (outcome.kind !== 'damaged') throw new Error('expected a damaged outcome');
    expect(outcome.result).not.toBe('kill');
    expect(outcome.hpAfter).toBeGreaterThanOrEqual(0);
  });
});

describe('resolveImpact — Odd-only (GDD §6.3)', () => {
  const ODD_ONLY: Trait = { type: 'oddOnly' };

  it('blocks an even value', () => {
    const outcome = resolveImpact(fakeRobot(5, 5, ODD_ONLY), 4);
    expect(outcome).toEqual({ kind: 'blocked', reason: 'oddOnly' });
  });

  it('an odd value damages normally', () => {
    const outcome = resolveImpact(fakeRobot(5, 5, ODD_ONLY), 3);
    expect(outcome).toMatchObject({ kind: 'damaged', damage: 3, hpAfter: 2, result: 'survive' });
  });

  it('a negative odd value damages 0 — it is not blocked', () => {
    const outcome = resolveImpact(fakeRobot(5, 5, ODD_ONLY), -3);
    expect(outcome).toMatchObject({ kind: 'damaged', damage: 0, hpAfter: 5, result: 'survive' });
  });
});

describe('resolveImpact — Even-only (GDD §6.3)', () => {
  const EVEN_ONLY: Trait = { type: 'evenOnly' };

  it('blocks an odd value', () => {
    const outcome = resolveImpact(fakeRobot(5, 5, EVEN_ONLY), 3);
    expect(outcome).toEqual({ kind: 'blocked', reason: 'evenOnly' });
  });

  it('zero is even — not blocked, 0 damage', () => {
    const outcome = resolveImpact(fakeRobot(5, 5, EVEN_ONLY), 0);
    expect(outcome).toMatchObject({ kind: 'damaged', damage: 0, hpAfter: 5, result: 'survive' });
  });
});

describe('resolveImpact — Weakness (GDD §6.4)', () => {
  const WEAK_5: Trait = { type: 'weakness', n: 5 };

  it('a positive multiple of n doubles damage', () => {
    const outcome = resolveImpact(fakeRobot(40, 40, WEAK_5), 15);
    expect(outcome).toMatchObject({ damage: 30, doubled: true, hpAfter: 10, result: 'survive' });
  });

  it('value 0 does not double', () => {
    const outcome = resolveImpact(fakeRobot(40, 40, WEAK_5), 0);
    expect(outcome).toMatchObject({ damage: 0, doubled: false, hpAfter: 40, result: 'survive' });
  });

  it('a negative multiple does not double (negative deals 0 anyway)', () => {
    const outcome = resolveImpact(fakeRobot(40, 40, WEAK_5), -10);
    expect(outcome).toMatchObject({ damage: 0, doubled: false, hpAfter: 40, result: 'survive' });
  });

  it('exact kill is evaluated on the doubled damage', () => {
    const outcome = resolveImpact(fakeRobot(30, 30, WEAK_5), 15);
    expect(outcome).toMatchObject({ damage: 30, doubled: true, hpAfter: 0, result: 'exact' });
  });
});
