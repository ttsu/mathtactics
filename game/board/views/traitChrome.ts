// Pure planning-phase trait silhouette (task 23, GDD §6.2–6.4, v0.7.1). Phaser-free so tests can
// assert a distinct descriptor per trait without a scene. `RobotView` paints from this;
// sizes live in layout.ts, only colours come from presentation.json `traits`.

import type { Trait } from '../../../sim/core/types';
import type { GameData } from '../../../sim/data/schemas';
import { WEAKNESS_N_FONT_SIZE } from '../layout';

export type TraitColours = GameData['presentation']['traits'];

/** What the robot view draws for a trait — the test-handle chrome, plus paint inputs. */
export interface TraitChrome {
  trait: Trait['type'];
  /** Weakness chest number, else null. */
  n: number | null;
  /** Identifying marks as drawn: antennae on basic/weakness/bounce-back (1), shield dots on
   * parity (1 = odd numbers blocked, 2 = even numbers blocked). */
  pairCount: number;
  coiled: boolean;
  shieldColor: string | null;
  /** Bounce-back body fill; null means the placeholder grey. */
  bodyColor: string | null;
  /** Weakness chest font size in design points; null when there is no chest numeral. */
  chestFontSize: number | null;
}

/** Shield dots showing the blocked parity (GDD §6.3): one = odd blocked, two = even blocked. */
export function blockedParityDots(trait: Trait): 1 | 2 | null {
  if (trait.type === 'evenOnly') return 1;
  if (trait.type === 'oddOnly') return 2;
  return null;
}

export function traitChrome(trait: Trait, colours: TraitColours): TraitChrome {
  switch (trait.type) {
    case 'none':
      return {
        trait: 'none',
        n: null,
        pairCount: 1,
        coiled: false,
        shieldColor: null,
        bodyColor: null,
        chestFontSize: null,
      };
    case 'weakness':
      return {
        trait: 'weakness',
        n: trait.n,
        pairCount: 1,
        coiled: false,
        shieldColor: null,
        bodyColor: null,
        chestFontSize: WEAKNESS_N_FONT_SIZE,
      };
    case 'bounceBack':
      return {
        trait: 'bounceBack',
        n: null,
        pairCount: 1,
        coiled: true,
        shieldColor: null,
        bodyColor: colours.bounceBackBodyColor,
        chestFontSize: null,
      };
    case 'oddOnly':
      return {
        trait: 'oddOnly',
        n: null,
        pairCount: 2,
        coiled: false,
        shieldColor: colours.oddShieldColor,
        bodyColor: null,
        chestFontSize: null,
      };
    case 'evenOnly':
      return {
        trait: 'evenOnly',
        n: null,
        pairCount: 1,
        coiled: false,
        shieldColor: colours.evenShieldColor,
        bodyColor: null,
        chestFontSize: null,
      };
  }
}
