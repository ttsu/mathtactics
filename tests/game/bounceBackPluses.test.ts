import { describe, expect, it } from 'vitest';
import { ROBOT_SIZE } from '../../game/board/layout';
import {
  bounceBackPlusOffsets,
  remainderLandOffset,
} from '../../game/board/playback/bounceBackPluses';

describe('remainderLandOffset', () => {
  it('lands to the right of the robot body', () => {
    const land = remainderLandOffset(28);
    expect(land.x).toBe(ROBOT_SIZE / 2 + 28);
    expect(land.y).toBe(0);
  });
});

describe('bounceBackPlusOffsets', () => {
  it('lays out a flurry of pluses around the robot', () => {
    expect(bounceBackPlusOffsets(0, 40)).toEqual([]);
    expect(bounceBackPlusOffsets(1, 40)).toEqual([{ x: 0, y: -40 * 0.35 }]);

    const cloud = bounceBackPlusOffsets(12, 40);
    expect(cloud).toHaveLength(12);
    expect(cloud.some((plus) => plus.x < 0)).toBe(true);
    expect(cloud.some((plus) => plus.x > 0)).toBe(true);
  });
});
