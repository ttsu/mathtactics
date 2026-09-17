// Trait-aware sensible-player ranking and reachability (task 22). Arrangement choice goes
// through `resolveImpact` so Weakness doubling, Bounce-back overshoot, and parity blocks
// rank the way the real rule does.

import { describe, expect, it } from 'vitest';
import type { Robot, Trait } from '../../sim/core/types';
import {
  arrangementRank,
  bestSequence,
  betterRank,
  canExactKillInAtMostNHits,
} from './sensiblePlayer';
import { fakeGameData, fakeRunState, fakeTile } from '../sim/commands/fixtures';

function probeRobot(hp: number, trait: Trait, maxHp = hp): Robot {
  return { robotId: 'probe', lane: 0, col: 7, hp, maxHp, trait, isBoss: false };
}

function rankCategory(robot: Robot, value: number): number {
  return arrangementRank(robot, value)[0];
}

describe('arrangementRank through resolveImpact', () => {
  it('keeps exact > undershoot > overshoot > blocked on an untraited robot', () => {
    const robot = probeRobot(10, { type: 'none' });
    expect(rankCategory(robot, 10)).toBe(2);
    expect(rankCategory(robot, 7)).toBe(1);
    expect(rankCategory(robot, 13)).toBe(0);
    expect(betterRank(arrangementRank(robot, 10), arrangementRank(robot, 9))).toBe(true);
    expect(betterRank(arrangementRank(robot, 9), arrangementRank(robot, 13))).toBe(true);
    expect(betterRank(arrangementRank(robot, 9), arrangementRank(robot, 8))).toBe(true);
  });

  it('ranks a Bounce-back overshoot with the overshoots, not the undershoots', () => {
    const robot = probeRobot(10, { type: 'bounceBack' });
    // 13 overshoots to hpAfter 3 (survive + bounceBack); 7 undershoots to 3 with no bounce.
    expect(rankCategory(robot, 13)).toBe(0);
    expect(rankCategory(robot, 7)).toBe(1);
    expect(rankCategory(robot, 10)).toBe(2);
    expect(betterRank(arrangementRank(robot, 7), arrangementRank(robot, 13))).toBe(true);
  });
});

describe('bestSequence is trait-aware', () => {
  it('never picks an even-valued arrangement for Odd-only when an odd one exists', () => {
    // Base 1; +9 → 10 (even, would be exact if untraited); empty → 1 (odd undershoot).
    const data = fakeGameData({
      tiles: [fakeTile({ id: 'add:9', n: 9 })],
    });
    const state = fakeRunState({
      cannonBaseValue: 1,
      pieces: { p1: { pieceId: 'p1', tileId: 'add:9' } },
    });
    const robot = probeRobot(10, { type: 'oddOnly' });
    const seq = bestSequence(state, data, ['p1'], robot, 1);
    expect(seq).toEqual([]);
    expect(rankCategory(robot, 10)).toBe(-1);
    expect(rankCategory(robot, 1)).toBe(1);
  });

  it('prefers the Weakness-5 arrangement whose doubled damage is exact', () => {
    // Base 1; +4 → 5 doubled to 10 (exact); +9 → 10 doubled to 20 (overshoot).
    const data = fakeGameData({
      tiles: [fakeTile({ id: 'add:4', n: 4 }), fakeTile({ id: 'add:9', n: 9 })],
    });
    const state = fakeRunState({
      cannonBaseValue: 1,
      pieces: {
        plus4: { pieceId: 'plus4', tileId: 'add:4' },
        plus9: { pieceId: 'plus9', tileId: 'add:9' },
      },
    });
    const robot = probeRobot(10, { type: 'weakness', n: 5 });
    const seq = bestSequence(state, data, ['plus4', 'plus9'], robot, 1);
    expect(seq).toEqual(['plus4']);
    expect(rankCategory(robot, 5)).toBe(2);
    expect(rankCategory(robot, 10)).toBe(0);
  });

  it('never prefers a Bounce-back overshoot over an undershoot', () => {
    // Base 7; empty → 7 undershoot; +6 → 13 overshoot (bounce-back refill). A ranking that
    // treated bounce-back overshoot as undershoot (hpAfter > 0) would pick the bigger 13.
    const data = fakeGameData({
      tiles: [fakeTile({ id: 'add:6', n: 6 })],
    });
    const state = fakeRunState({
      cannonBaseValue: 7,
      pieces: { p1: { pieceId: 'p1', tileId: 'add:6' } },
    });
    const robot = probeRobot(10, { type: 'bounceBack' });
    const seq = bestSequence(state, data, ['p1'], robot, 1);
    expect(seq).toEqual([]);
    expect(betterRank(arrangementRank(robot, 7), arrangementRank(robot, 13))).toBe(true);
  });
});

describe('canExactKillInAtMostNHits', () => {
  it('counts a Weakness-doubled exact as a 1-hit kill', () => {
    const robot = probeRobot(10, { type: 'weakness', n: 5 });
    expect(canExactKillInAtMostNHits(robot, [5], 1)).toBe(true);
    expect(canExactKillInAtMostNHits(robot, [4], 1)).toBe(false);
  });

  it('does not count a blocked-parity miss as a kill', () => {
    const evenHp = probeRobot(10, { type: 'oddOnly' });
    expect(canExactKillInAtMostNHits(evenHp, [2, 4, 8], 3)).toBe(false);
    expect(canExactKillInAtMostNHits(evenHp, [1, 2], 2)).toBe(false);
    // One odd 5 chips even HP 10 to 5 — not a kill until a second odd hit.
    expect(canExactKillInAtMostNHits(evenHp, [5], 1)).toBe(false);
    expect(canExactKillInAtMostNHits(evenHp, [5], 2)).toBe(true);
    expect(canExactKillInAtMostNHits(probeRobot(5, { type: 'oddOnly' }), [5], 1)).toBe(true);
  });

  it('finds an untraited 3-hit path (future Boss bound) and rejects 2 hits for the same HP', () => {
    const robot = probeRobot(6, { type: 'none' });
    expect(canExactKillInAtMostNHits(robot, [2], 3)).toBe(true);
    expect(canExactKillInAtMostNHits(robot, [2], 2)).toBe(false);
  });
});
