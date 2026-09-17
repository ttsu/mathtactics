import { describe, expect, it } from 'vitest';
import { ROBOT_HP_FONT_SIZE } from '../../game/board/layout';
import { traitChrome } from '../../game/board/views/traitChrome';
import type { Trait } from '../../sim/core/types';
import { fakeTraitSettings } from '../helpers/playbackSettings';

const colours = fakeTraitSettings();

describe('traitChrome', () => {
  it('returns a distinct descriptor per trait type', () => {
    const none = traitChrome({ type: 'none' }, colours);
    const weakness = traitChrome({ type: 'weakness', n: 5 }, colours);
    const bounceBack = traitChrome({ type: 'bounceBack' }, colours);
    const oddOnly = traitChrome({ type: 'oddOnly' }, colours);
    const evenOnly = traitChrome({ type: 'evenOnly' }, colours);

    const keys = [none, weakness, bounceBack, oddOnly, evenOnly].map((chrome) =>
      JSON.stringify(chrome),
    );
    expect(new Set(keys).size).toBe(5);

    expect(none).toMatchObject({
      trait: 'none',
      n: null,
      pairCount: 1,
      coiled: false,
      shieldColor: null,
      bodyColor: null,
    });
    expect(weakness).toMatchObject({
      trait: 'weakness',
      n: 5,
      pairCount: 1,
      coiled: false,
      shieldColor: null,
    });
    expect(bounceBack).toMatchObject({
      trait: 'bounceBack',
      n: null,
      coiled: true,
      bodyColor: colours.bounceBackBodyColor,
      shieldColor: null,
    });
    expect(oddOnly).toMatchObject({
      trait: 'oddOnly',
      pairCount: 1,
      coiled: false,
      shieldColor: colours.oddShieldColor,
    });
    expect(evenOnly).toMatchObject({
      trait: 'evenOnly',
      pairCount: 2,
      coiled: false,
      shieldColor: colours.evenShieldColor,
    });
    expect(oddOnly.shieldColor).not.toBe(evenOnly.shieldColor);
  });

  it('exposes each Weakness n and keeps the chest numeral smaller than HP', () => {
    for (const n of [2, 5, 10] as const) {
      const chrome = traitChrome({ type: 'weakness', n }, colours);
      expect(chrome.n).toBe(n);
      expect(chrome.chestFontSize).toBeLessThan(ROBOT_HP_FONT_SIZE);
    }
  });

  it('does not invent chrome for a trait the helper does not know', () => {
    const traits: Trait[] = [
      { type: 'none' },
      { type: 'weakness', n: 2 },
      { type: 'bounceBack' },
      { type: 'oddOnly' },
      { type: 'evenOnly' },
    ];
    for (const trait of traits) {
      expect(traitChrome(trait, colours).trait).toBe(trait.type);
    }
  });
});
