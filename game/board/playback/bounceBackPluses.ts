// Phaser-free layout of Bounce-back remainder landing and the tiny plus flurry (GDD §6.2).
// Positions are design-point offsets from the robot centre; SegmentPlayer converts to world.

import { ROBOT_SIZE } from '../layout';

export interface PlusOffset {
  readonly x: number;
  readonly y: number;
}

/** Where the remainder numeral sits after popping off the ball — to the right of the robot. */
export function remainderLandOffset(landPt: number): PlusOffset {
  return { x: ROBOT_SIZE / 2 + landPt, y: 0 };
}

/** Cloud of tiny pluses around the robot. `count` 0 → empty. Deterministic (no RNG). */
export function bounceBackPlusOffsets(count: number, spreadPt: number): PlusOffset[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: -spreadPt * 0.35 }];
  const offsets: PlusOffset[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    const angle = -Math.PI * 0.85 + t * Math.PI * 1.7;
    const radius = spreadPt * (0.4 + (i % 4) * 0.16);
    offsets.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius - spreadPt * 0.12,
    });
  }
  return offsets;
}
