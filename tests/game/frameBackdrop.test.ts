import { describe, expect, it } from 'vitest';
import { frameBackdropPlacement } from '../../game/state/frameBackdrop';

describe('frameBackdropPlacement', () => {
  it('returns null when the canvas fills the viewport width', () => {
    expect(frameBackdropPlacement({ top: 0, width: 1180, height: 820 }, 1180)).toBeNull();
    expect(frameBackdropPlacement({ top: 0, width: 844, height: 390 }, 844)).toBeNull();
  });

  it('fills horizontal letterboxing at 1600×900', () => {
    const width = (900 * 1180) / 820;
    const left = (1600 - width) / 2;
    expect(frameBackdropPlacement({ top: 0, width, height: 900 }, 1600)).toEqual({
      top: 0,
      height: 900,
    });
    expect(left).toBeGreaterThan(0);
  });
});
