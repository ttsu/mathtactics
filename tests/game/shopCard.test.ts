import { describe, expect, it } from 'vitest';
import { shopCardStatus } from '../../game/state/shopCard';
import type { ShopOffer } from '../../sim/core/types';

const tile: ShopOffer = { slot: 'tile:0', kind: 'tile', tileId: 'add:5', price: 4, bought: false };
const cannon: ShopOffer = { slot: 'cannon', kind: 'cannon', price: 10, bought: false, available: true };
const upgrade: ShopOffer = {
  slot: 'upgrade',
  kind: 'upgrade',
  price: 12,
  bought: false,
  fromValue: 1,
  toValue: 2,
};

describe('shopCardStatus', () => {
  it('is affordable when coins cover the price', () => {
    expect(shopCardStatus(tile, 4)).toBe('affordable');
    expect(shopCardStatus(cannon, 10)).toBe('affordable');
    expect(shopCardStatus(upgrade, 12)).toBe('affordable');
  });

  it('is unaffordable when coins are short — still a tappable state', () => {
    expect(shopCardStatus(tile, 3)).toBe('unaffordable');
    expect(shopCardStatus(cannon, 9)).toBe('unaffordable');
  });

  it('is bought once the slot is taken', () => {
    expect(shopCardStatus({ ...tile, bought: true }, 20)).toBe('bought');
    expect(shopCardStatus({ ...cannon, bought: true }, 20)).toBe('bought');
  });

  it('is unavailable when the cannon card is at max (keeps its slot)', () => {
    expect(shopCardStatus({ ...cannon, available: false }, 20)).toBe('unavailable');
  });

  it('treats unavailable ahead of bought and price', () => {
    expect(shopCardStatus({ ...cannon, available: false, bought: false }, 0)).toBe('unavailable');
  });
});
