import { describe, expect, it } from 'vitest';
import { parseGameData } from '../../../sim/data/load';
import { cannonPrice, tilePrice, upgradePrice } from '../../../sim/shop/pricing';
import { loadRawGameData } from '../../helpers/loadDataFiles';

const data = parseGameData(loadRawGameData());

describe('shop pricing (shipped shop.json)', () => {
  it('prices each priceCategory from the table, not by N', () => {
    expect(tilePrice('add:1', data)).toBe(4);
    expect(tilePrice('add:10', data)).toBe(4);
    expect(tilePrice('sub:3', data)).toBe(4);
    expect(tilePrice('mul:2', data)).toBe(6);
    expect(tilePrice('mul:5', data)).toBe(6);
    expect(tilePrice('mul:6', data)).toBe(9);
    expect(tilePrice('mul:10', data)).toBe(9);
  });

  it('escalates cannon price: 10/15/20/25 with 1–4 cannons owned', () => {
    expect(cannonPrice(1, data)).toBe(10);
    expect(cannonPrice(2, data)).toBe(15);
    expect(cannonPrice(3, data)).toBe(20);
    expect(cannonPrice(4, data)).toBe(25);
  });

  it('escalates upgrade price: 12/18/24', () => {
    expect(upgradePrice(0, data)).toBe(12);
    expect(upgradePrice(1, data)).toBe(18);
    expect(upgradePrice(2, data)).toBe(24);
  });
});
