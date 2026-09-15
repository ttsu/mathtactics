import { describe, expect, it } from 'vitest';
import { TRAY_CAPACITY, TRAY_SLOT_PITCH } from '../../game/board/layout';
import {
  clampTrayScroll,
  classifyTrayGesture,
  isTraySlotVisible,
  maxTrayScroll,
  scrollAfterDrag,
  trayOverflows,
} from '../../game/board/trayScroll';

describe('tray scrolling', () => {
  it('only scrolls once there are more pieces than slots', () => {
    expect(trayOverflows(TRAY_CAPACITY)).toBe(false);
    expect(trayOverflows(TRAY_CAPACITY + 1)).toBe(true);
    expect(maxTrayScroll(3)).toBe(0);
    expect(maxTrayScroll(TRAY_CAPACITY + 4)).toBe(4);
  });

  it('clamps to whole slots within range', () => {
    const count = TRAY_CAPACITY + 3;
    expect(clampTrayScroll(-2, count)).toBe(0);
    expect(clampTrayScroll(1.4, count)).toBe(1);
    expect(clampTrayScroll(9, count)).toBe(3);
  });

  it('dragging left by one slot pitch reveals one more piece on the right', () => {
    const count = TRAY_CAPACITY + 3;
    expect(scrollAfterDrag(0, -TRAY_SLOT_PITCH, count)).toBe(1);
    expect(scrollAfterDrag(2, TRAY_SLOT_PITCH * 2, count)).toBe(0);
    expect(scrollAfterDrag(0, -TRAY_SLOT_PITCH * 10, count)).toBe(3);
  });

  it('shows exactly TRAY_CAPACITY slots from the scroll offset', () => {
    expect(isTraySlotVisible(0, 1)).toBe(false);
    expect(isTraySlotVisible(1, 1)).toBe(true);
    expect(isTraySlotVisible(TRAY_CAPACITY, 1)).toBe(true);
    expect(isTraySlotVisible(TRAY_CAPACITY + 1, 1)).toBe(false);
  });
});

describe('classifyTrayGesture', () => {
  it('is always a drag when the tray does not overflow', () => {
    expect(classifyTrayGesture(40, 0, 12, false)).toBe('drag');
  });

  it('waits for the threshold, then picks scroll for horizontal and drag otherwise', () => {
    expect(classifyTrayGesture(5, 5, 12, true)).toBe('pending');
    expect(classifyTrayGesture(-20, 4, 12, true)).toBe('scroll');
    expect(classifyTrayGesture(4, -20, 12, true)).toBe('drag');
  });
});
