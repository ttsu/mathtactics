// DETONATE (GDD §4 step 4, §7.2, TR §6 "mode: 'run' details"). Pure: resolves the robots queued
// by `advance.ts` (col 1 leaving the board) against the base, one at a time in lane order.
//
// Each detonation deals damage equal to the robot's remaining HP (never more than `maxHp`,
// GDD §7.2 — that cap is already baked into `robot.hp` by `impact.ts`'s Bounce-back clamp).
// `baseHp` is not clamped here; the caller/UI clamps at 0 for display (TR §6).

import type { GameEvent, Robot } from '../core/types';

export interface DetonateResult {
  baseHp: number;
  events: GameEvent[];
}

export function detonate(detonating: Robot[], baseHp: number, firstStep: number): DetonateResult {
  let step = firstStep;
  let hp = baseHp;
  const events: GameEvent[] = [];

  // Lane order (GDD §7.2), explicit here rather than relying on `advance`'s incidental ordering.
  const sorted = [...detonating].sort((a, b) => a.lane - b.lane);

  for (const robot of sorted) {
    const group = `detonate:${robot.lane}`;
    const amount = robot.hp;
    const hpBefore = hp;
    hp -= amount;

    events.push({
      step: step++,
      group,
      type: 'RobotDetonated',
      robotId: robot.robotId,
      lane: robot.lane,
      damage: amount,
    });
    events.push({
      step: step++,
      group,
      type: 'BaseDamaged',
      amount,
      hpBefore,
      hpAfter: hp,
    });
  }

  return { baseHp: hp, events };
}
