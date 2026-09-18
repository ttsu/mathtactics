import { describe, expect, it } from 'vitest';
import {
  DEBUG_TRIGGERS,
  isDebugHotkey,
  longPressHeld,
  queryWantsDebug,
  recordTapSequence,
  shakeStep,
} from '../../game/state/debug';

describe('recordTapSequence', () => {
  it('fires on the Nth tap inside the window and resets', () => {
    let times: number[] = [];
    for (let i = 0; i < DEBUG_TRIGGERS.tapCount - 1; i++) {
      const result = recordTapSequence(times, i * 100);
      expect(result.fired).toBe(false);
      times = result.times;
    }
    const last = recordTapSequence(times, (DEBUG_TRIGGERS.tapCount - 1) * 100);
    expect(last.fired).toBe(true);
    expect(last.times).toEqual([]);
  });

  it('drops taps that fall outside the window', () => {
    const first = recordTapSequence([], 0);
    const late = recordTapSequence(first.times, DEBUG_TRIGGERS.tapWindowMs + 1);
    expect(late.fired).toBe(false);
    expect(late.times).toEqual([DEBUG_TRIGGERS.tapWindowMs + 1]);
  });
});

describe('longPressHeld', () => {
  it('is false before the hold, true at the threshold', () => {
    expect(longPressHeld(0, DEBUG_TRIGGERS.longPressMs - 1)).toBe(false);
    expect(longPressHeld(0, DEBUG_TRIGGERS.longPressMs)).toBe(true);
  });
});

describe('shakeStep', () => {
  it('does not fire on the first sample, then fires on a large delta', () => {
    const first = shakeStep(null, { x: 0, y: 0, z: 9.8 }, 0);
    expect(first.fired).toBe(false);
    const quiet = shakeStep(first.next, { x: 0.2, y: -0.1, z: 9.7 }, 100);
    expect(quiet.fired).toBe(false);
    const spike = shakeStep(quiet.next, { x: 20, y: -15, z: 30 }, 200);
    expect(spike.fired).toBe(true);
  });

  it('respects the cooldown after a fire', () => {
    const first = shakeStep(null, { x: 0, y: 0, z: 0 }, 0);
    const fire = shakeStep(first.next, { x: 40, y: 0, z: 0 }, 10);
    expect(fire.fired).toBe(true);
    const again = shakeStep(
      fire.next,
      { x: 0, y: 0, z: 0 },
      10 + DEBUG_TRIGGERS.shakeCooldownMs - 1,
    );
    expect(again.fired).toBe(false);
  });
});

describe('queryWantsDebug / isDebugHotkey', () => {
  it('accepts ?debug=1, ?debug, and #debug', () => {
    expect(queryWantsDebug('?debug=1', '')).toBe(true);
    expect(queryWantsDebug('debug=true', '')).toBe(true);
    expect(queryWantsDebug('?debug', '')).toBe(true);
    expect(queryWantsDebug('', '#debug')).toBe(true);
    expect(queryWantsDebug('', '')).toBe(false);
    expect(queryWantsDebug('?debug=0', '')).toBe(false);
  });

  it('matches Ctrl/Cmd+Shift+D', () => {
    expect(isDebugHotkey({ key: 'D', shiftKey: true, ctrlKey: true, metaKey: false })).toBe(true);
    expect(isDebugHotkey({ key: 'd', shiftKey: true, ctrlKey: false, metaKey: true })).toBe(true);
    expect(isDebugHotkey({ key: 'd', shiftKey: true, ctrlKey: false, metaKey: false })).toBe(false);
    expect(isDebugHotkey({ key: 'd', shiftKey: false, ctrlKey: true, metaKey: false })).toBe(false);
  });
});
