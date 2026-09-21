import { describe, expect, it } from 'vitest';
import { parseGameData } from '../../../sim/data/load';
import { loadRawGameData } from '../../helpers/loadDataFiles';

const data = parseGameData(loadRawGameData());

describe('puzzles.json', () => {
  it('has unique ids, stars 1-3, and packs 1-5', () => {
    const ids = data.puzzles.puzzles.map((puzzle) => puzzle.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const puzzle of data.puzzles.puzzles) {
      expect([1, 2, 3]).toContain(puzzle.stars);
      expect([1, 2, 3, 4, 5]).toContain(puzzle.pack);
      expect(puzzle.name.length).toBeGreaterThan(0);
    }
  });

  it('rejects a playable puzzle whose first wave has no cannon', () => {
    const raw = loadRawGameData();
    const puzzles = structuredClone(data.puzzles);
    puzzles.puzzles[0] = {
      id: 'no-cannon',
      name: 'No Cannon',
      stars: 1,
      pack: 1,
      waves: [{ grantTiles: [], boardTiles: [], robots: [], cannons: [], spawns: [] }],
    };
    raw.puzzles = puzzles;
    expect(() => parseGameData(raw)).toThrow(/wave 1 must place at least one cannon/);
  });

  it('rejects an unknown tile on a playable wave', () => {
    const raw = loadRawGameData();
    const puzzles = structuredClone(data.puzzles);
    const playable = puzzles.puzzles.find((puzzle) => puzzle.waves);
    playable!.waves![0]!.grantTiles = ['add:99' as never];
    raw.puzzles = puzzles;
    expect(() => parseGameData(raw)).toThrow(/puzzles\.json/);
  });

  it('makes Recipe a bounce-back exact-amount exam at 1 HP', () => {
    const recipe = data.puzzles.puzzles.find((puzzle) => puzzle.id === 'recipe');
    expect(recipe?.stars).toBe(3);
    expect(recipe?.baseHp).toBe(1);
    expect(recipe?.waves).toHaveLength(5);
    const robots = (recipe?.waves ?? []).flatMap((wave) => [
      ...wave.spawns.map((spawn) => spawn.robot),
      ...wave.robots.map((robot) => robot.robot),
    ]);
    expect(robots.length).toBeGreaterThanOrEqual(10);
    expect(robots.every((id) => id === 'bounce-back')).toBe(true);
  });
});
