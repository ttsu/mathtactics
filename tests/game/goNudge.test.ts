import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../sim/commands/applyCommand';
import { goButtonClassName, goNudgeAnimationKey, planningLayoutKey } from '../../game/ui/goNudge';
import { fakeGameData, fakeRunState } from '../sim/commands/fixtures';

const data = fakeGameData();

describe('planningLayoutKey', () => {
  it('is empty with no run', () => {
    expect(planningLayoutKey(null)).toBe('');
  });

  it('changes when a tile is placed, and not when coins change', () => {
    const before = fakeRunState({
      tray: ['p1'],
      pieces: { p1: { pieceId: 'p1', tileId: 'add:2' } },
    });
    const placed = applyCommand(
      before,
      { type: 'placeTile', pieceId: 'p1', to: { lane: 1, col: 3 } },
      data,
    );
    if (!placed.ok) throw new Error(placed.error);
    expect(planningLayoutKey(placed.state)).not.toBe(planningLayoutKey(before));
    expect(planningLayoutKey({ ...before, coins: 99 })).toBe(planningLayoutKey(before));
  });

  it('changes when a cannon moves', () => {
    const before = fakeRunState();
    const moved = applyCommand(before, { type: 'moveCannon', fromLane: 0, toLane: 1 }, data);
    if (!moved.ok) throw new Error(moved.error);
    expect(planningLayoutKey(moved.state)).not.toBe(planningLayoutKey(before));
  });
});

describe('go nudge class and animation key', () => {
  it('adds is-planning only while Go is enabled, and remounts after a layout change', () => {
    expect(goButtonClassName(true)).toBe('hud-button hud-button-go is-planning');
    expect(goButtonClassName(false)).toBe('hud-button hud-button-go');
    expect(goNudgeAnimationKey(false, 'abc')).toBe('idle');
    expect(goNudgeAnimationKey(true, 'abc')).toBe('planning:abc');
    expect(goNudgeAnimationKey(true, 'xyz')).not.toBe(goNudgeAnimationKey(true, 'abc'));
  });
});
