import { describe, expect, it } from 'vitest';
import { gameData } from '../../game/state/gameData';

describe('gameData', () => {
  it('loads and validates the real /data content', () => {
    expect(gameData.economy.baseHp).toBe(100);
    expect(gameData.economy.startCoins).toBe(0);
    expect(gameData.tiles.length).toBeGreaterThan(0);
  });
});
