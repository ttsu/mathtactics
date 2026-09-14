import { describe, expect, it } from 'vitest';
import { diffKeys, planCannons } from '../../game/board/reconcile';

describe('diffKeys', () => {
  it('splits keys into added, removed and kept', () => {
    expect(diffKeys(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual({
      added: ['d'],
      removed: ['a'],
      kept: ['b', 'c'],
    });
  });
});

describe('planCannons', () => {
  it('moves the cannon view when one lane is vacated and another armed', () => {
    expect(planCannons([1, 3], [false, false, false, true, true])).toEqual({
      kept: [3],
      moved: [{ from: 1, to: 4 }],
      added: [],
      removed: [],
    });
  });

  it('creates and destroys views when the cannon count changes', () => {
    expect(planCannons([], [true, false, true, false, false])).toEqual({
      kept: [],
      moved: [],
      added: [0, 2],
      removed: [],
    });
    expect(planCannons([0, 2, 4], [false, true, false, false, false])).toEqual({
      kept: [],
      moved: [{ from: 0, to: 1 }],
      added: [],
      removed: [2, 4],
    });
    expect(planCannons([2], [])).toEqual({ kept: [], moved: [], added: [], removed: [2] });
  });
});
