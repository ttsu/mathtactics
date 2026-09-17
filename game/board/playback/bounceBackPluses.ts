// Phaser-free layout of the green pluses that float around a Bounce-back refill (GDD §6.2).
// Positions are design-point offsets from the robot centre; SegmentPlayer converts to world.

export interface PlusOffset {
  readonly x: number;
  readonly y: number;
}

/** Arc of pluses above the robot. `count` 0 → empty; 1 → a single plus on the crest. */
export function bounceBackPlusOffsets(count: number, spreadPt: number): PlusOffset[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: -spreadPt * 0.35 }];
  const offsets: PlusOffset[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const angle = -Math.PI * 0.82 + t * Math.PI * 0.64;
    offsets.push({
      x: Math.cos(angle) * spreadPt,
      y: Math.sin(angle) * spreadPt * 0.45,
    });
  }
  return offsets;
}
