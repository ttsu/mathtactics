import { describe, expect, it } from 'vitest';
import {
  decidePointerDown,
  MOUSE_POINTER_ID,
  pointersToReleaseAfterTouchEnd,
  pointersToReleaseOnTouchStart,
  touchIdentifiers,
  type PointerSnapshot,
} from '../../game/board/pointerSync';

const mouse = (over: Partial<PointerSnapshot> = {}): PointerSnapshot => ({
  id: MOUSE_POINTER_ID,
  identifier: 0,
  active: true,
  isDown: false,
  wasTouch: false,
  ...over,
});

const touch = (id: number, over: Partial<Omit<PointerSnapshot, 'id'>> = {}): PointerSnapshot => ({
  id,
  identifier: id,
  active: false,
  isDown: false,
  wasTouch: true,
  ...over,
});

describe('touchIdentifiers', () => {
  it('reads identifier from a TouchList-like', () => {
    expect(touchIdentifiers([{ identifier: 0 }, { identifier: 7 }])).toEqual([0, 7]);
    expect(touchIdentifiers([])).toEqual([]);
  });
});

describe('pointersToReleaseOnTouchStart', () => {
  it('releases nothing when the touch slot is free', () => {
    expect(pointersToReleaseOnTouchStart([mouse(), touch(1)], [0], [0])).toEqual([]);
  });

  it('releases a pointer whose identifier is not on the surface', () => {
    const stuck = touch(1, { identifier: 5, active: true, isDown: true });
    expect(pointersToReleaseOnTouchStart([mouse(), stuck], [0], [0])).toEqual([1]);
  });

  it('releases a pointer when Safari reuses its identifier for a new finger', () => {
    const stuck = touch(1, { identifier: 1, active: true, isDown: true });
    expect(pointersToReleaseOnTouchStart([mouse(), stuck], [1], [1])).toEqual([1]);
  });

  it('keeps a live first finger when a second finger starts', () => {
    const first = touch(1, { identifier: 2, active: true, isDown: true });
    const second = touch(2, { identifier: 3, active: false });
    expect(pointersToReleaseOnTouchStart([mouse(), first, second], [2, 3], [3])).toEqual([]);
  });

  it('never releases the mouse pointer', () => {
    expect(
      pointersToReleaseOnTouchStart(
        [mouse({ isDown: true }), touch(1, { active: true })],
        [9],
        [9],
      ),
    ).toEqual([1]);
  });
});

describe('pointersToReleaseAfterTouchEnd', () => {
  it('releases nothing when Phaser already deactivated the pointer', () => {
    expect(pointersToReleaseAfterTouchEnd([mouse(), touch(1)], [])).toEqual([]);
  });

  it('releases a pointer still active after the surface is empty', () => {
    const stuck = touch(1, { identifier: 4, active: true, isDown: true });
    expect(pointersToReleaseAfterTouchEnd([mouse(), stuck], [])).toEqual([1]);
  });

  it('keeps a finger that is still down when another lifts', () => {
    const still = touch(1, { identifier: 2, active: true, isDown: true });
    const lifted = touch(2, { identifier: 3, active: false });
    expect(pointersToReleaseAfterTouchEnd([mouse(), still, lifted], [2])).toEqual([]);
  });
});

describe('decidePointerDown', () => {
  const finger = { id: 1, wasTouch: true };
  const mousePtr = { id: MOUSE_POINTER_ID, wasTouch: false };

  it('starts when there is no gesture', () => {
    expect(decidePointerDown(null, finger, undefined)).toBe('start');
  });

  it('ignores a second live finger (task 09 multi-touch)', () => {
    expect(
      decidePointerDown(
        { pointerId: 1 },
        { id: 2, wasTouch: true },
        { isDown: true, wasTouch: true },
      ),
    ).toBe('ignore');
  });

  it('restarts when the same pointer slot presses again (missed up)', () => {
    expect(decidePointerDown({ pointerId: 1 }, finger, { isDown: true, wasTouch: true })).toBe(
      'restart',
    );
  });

  it('restarts when the tracked pointer is no longer down', () => {
    expect(
      decidePointerDown(
        { pointerId: 1 },
        { id: 2, wasTouch: true },
        { isDown: false, wasTouch: true },
      ),
    ).toBe('restart');
  });

  it('restarts when the tracked pointer has vanished', () => {
    expect(decidePointerDown({ pointerId: 1 }, finger, undefined)).toBe('restart');
  });

  it('lets a touch preempt a latched mouse (iOS ghost mousedown)', () => {
    expect(
      decidePointerDown({ pointerId: MOUSE_POINTER_ID }, finger, { isDown: true, wasTouch: false }),
    ).toBe('restart');
  });

  it('ignores a mouse press while a real touch drag is in progress', () => {
    expect(decidePointerDown({ pointerId: 1 }, mousePtr, { isDown: true, wasTouch: true })).toBe(
      'ignore',
    );
  });
});
