import { describe, expect, it } from 'vitest';
import { bounceBackPlusOffsets } from '../../game/board/playback/bounceBackPluses';

describe('bounceBackPlusOffsets', () => {
  it('lays out an arc of pluses above the robot', () => {
    expect(bounceBackPlusOffsets(0, 36)).toEqual([]);
    expect(bounceBackPlusOffsets(1, 36)).toEqual([{ x: 0, y: -36 * 0.35 }]);

    const five = bounceBackPlusOffsets(5, 36);
    expect(five).toHaveLength(5);
    expect(five[0]!.x).toBeLessThan(0);
    expect(five[4]!.x).toBeGreaterThan(0);
    expect(five[2]!.x).toBeCloseTo(0, 5);
    for (const plus of five) {
      expect(plus.y).toBeLessThan(0);
    }
  });
});
