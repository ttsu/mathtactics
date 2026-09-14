// Per-ball impact resolution (GDD §5.4, §6.2-6.5). One pure function so the rule lives in
// exactly one place — traits are implemented and tested here even though they only appear in
// play from M4 (task 07 requirement 1). Trait order: Parity -> Weakness -> apply damage ->
// Bounce-back check (GDD §5.4, §6.5).

import type { Robot } from '../core/types';

/** Blocked by parity (GDD §6.3): 0 damage, ball consumed, no hit on the robot at all. */
export interface BlockedOutcome {
  kind: 'blocked';
  reason: 'oddOnly' | 'evenOnly';
}

/** A hit landed (possibly for 0 damage). `bounceBack` is present only when the robot has the
 * Bounce-back trait *and* the hit overshot its HP (`damage > hpBefore`, GDD §6.2) — that's
 * exactly when `RobotBouncedBack` should be emitted, so `fire.ts` doesn't need to re-derive it. */
export interface DamagedOutcome {
  kind: 'damaged';
  /** Post-weakness damage (`max(0, value)`, doubled if Weakness applied). */
  damage: number;
  /** True when Weakness doubled `damage`. */
  doubled: boolean;
  hpBefore: number;
  /** Post-bounce-back HP for Bounce-back robots; otherwise `hpBefore - damage`. */
  hpAfter: number;
  result: 'exact' | 'kill' | 'survive';
  bounceBack: { overshoot: number } | null;
}

export type ImpactOutcome = BlockedOutcome | DamagedOutcome;

function isEven(value: number): boolean {
  return value % 2 === 0;
}

/**
 * Resolves one ball's impact on `robot` exactly per GDD §5.4. Never mutates `robot` — the caller
 * (`fire.ts`) applies `hpAfter`/removal to the board itself.
 */
export function resolveImpact(robot: Robot, ballValue: number): ImpactOutcome {
  // 1. Parity (GDD §6.3): wrong-parity ball is blocked outright, no damage step at all.
  if (robot.trait.type === 'oddOnly' && isEven(ballValue)) {
    return { kind: 'blocked', reason: 'oddOnly' };
  }
  if (robot.trait.type === 'evenOnly' && !isEven(ballValue)) {
    return { kind: 'blocked', reason: 'evenOnly' };
  }

  // 2. Base damage.
  let damage = Math.max(0, ballValue);

  // 3. Weakness (GDD §6.4): only positive multiples of n double the damage.
  let doubled = false;
  if (robot.trait.type === 'weakness' && ballValue > 0 && ballValue % robot.trait.n === 0) {
    damage *= 2;
    doubled = true;
  }

  // 4. Apply.
  const hpBefore = robot.hp;
  let hpAfter: number;
  let bounceBack: { overshoot: number } | null = null;
  if (robot.trait.type === 'bounceBack') {
    hpAfter = Math.min(Math.abs(hpBefore - damage), robot.maxHp);
    if (damage > hpBefore) {
      bounceBack = { overshoot: damage - hpBefore };
    }
  } else {
    hpAfter = hpBefore - damage;
  }

  // 5. Outcome. Bounce-back's `hpAfter` is never negative, so `kill` never happens for it
  // (GDD §6.2 table) — this falls out of the formula rather than needing a separate branch.
  const result: DamagedOutcome['result'] =
    hpAfter === 0 ? 'exact' : hpAfter < 0 ? 'kill' : 'survive';

  return { kind: 'damaged', damage, doubled, hpBefore, hpAfter, result, bounceBack };
}
