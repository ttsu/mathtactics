import { describe, expect, it } from 'vitest';
import { DESIGN_WIDTH, placementOverCanvas } from '../../game/state/designSpace';

describe('placementOverCanvas', () => {
  it('is identity when the canvas fills a 1180×820 viewport', () => {
    expect(
      placementOverCanvas({ left: 0, top: 0, width: DESIGN_WIDTH }, { left: 0, top: 0 }),
    ).toEqual({ left: 0, top: 0, scale: 1 });
  });

  it('offsets and scales for a letterboxed canvas (1366×1024 viewport)', () => {
    // FIT: width-limited → 1366 wide, 1366 × 820/1180 ≈ 949.25 tall, centred vertically.
    const height = (1366 * 820) / 1180;
    const top = (1024 - height) / 2;
    const placement = placementOverCanvas({ left: 0, top, width: 1366 }, { left: 0, top: 0 });
    expect(placement.left).toBe(0);
    expect(placement.top).toBeCloseTo(37.37, 2);
    expect(placement.scale).toBeCloseTo(1366 / 1180, 10);
  });

  it('is relative to the container', () => {
    expect(placementOverCanvas({ left: 150, top: 20, width: 590 }, { left: 50, top: 10 })).toEqual({
      left: 100,
      top: 10,
      scale: 0.5,
    });
  });
});
