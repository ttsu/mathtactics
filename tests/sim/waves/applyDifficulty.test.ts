import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../../sim/commands/applyCommand';
import { createStreams, nextInt } from '../../../sim/core/rng';
import type { DifficultyId } from '../../../sim/core/types';
import { parseGameData } from '../../../sim/data/load';
import { rollShop } from '../../../sim/shop/rollShop';
import { applyDifficulty } from '../../../sim/waves/applyDifficulty';
import { rollWave } from '../../../sim/waves/rollWave';
import { loadRawGameData } from '../../helpers/loadDataFiles';
import { fakeDifficulty } from '../../helpers/difficulty';

const data = parseGameData(loadRawGameData());

function newRun(seed: string, difficulty?: DifficultyId) {
  const result = applyCommand(
    null,
    difficulty ? { type: 'newRun', seed, difficulty } : { type: 'newRun', seed },
    data,
  );
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function overlayCounts(difficulty: DifficultyId) {
  return data.waves.waves.flatMap((wave) => {
    const overlaid = applyDifficulty(wave, difficulty, data);
    if (!('procedural' in overlaid)) return [];
    return overlaid.procedural.groups.map((group) => group.count);
  });
}

describe('difficulty.json schema', () => {
  it('loads the real file with Easy / Normal / Hard', () => {
    expect(data.difficulty.default).toBe('normal');
    expect(data.difficulty.modes.easy.stars).toBe(1);
    expect(data.difficulty.modes.normal.stars).toBe(2);
    expect(data.difficulty.modes.hard.stars).toBe(3);
    expect(data.difficulty.modes.hard.dropTemplates).toEqual(['basic']);
    expect(data.difficulty.modes.hard.hp.nonBoss.mul).toBe(120);
    expect(data.difficulty.modes.hard.hp.parity.mul).toBe(100);
  });

  it('rejects a missing normal key', () => {
    const raw = loadRawGameData();
    const difficulty = fakeDifficulty();
    const modes = { ...difficulty.modes };
    delete (modes as { normal?: unknown }).normal;
    raw.difficulty = { ...difficulty, modes };
    expect(() => parseGameData(raw)).toThrow(/difficulty\.json/);
  });

  it('rejects mul 0', () => {
    const raw = loadRawGameData();
    const difficulty = structuredClone(data.difficulty);
    difficulty.modes.easy.hp.nonBoss.mul = 0;
    raw.difficulty = difficulty;
    expect(() => parseGameData(raw)).toThrow(/difficulty\.json/);
  });

  it('rejects Hard dropTemplates naming a Boss', () => {
    const raw = loadRawGameData();
    const difficulty = structuredClone(data.difficulty);
    difficulty.modes.hard.dropTemplates = ['boss'];
    raw.difficulty = difficulty;
    expect(() => parseGameData(raw)).toThrow(/Boss template/);
  });

  it('rejects duplicate stars', () => {
    const raw = loadRawGameData();
    const difficulty = structuredClone(data.difficulty);
    difficulty.modes.easy.stars = 2;
    raw.difficulty = difficulty;
    expect(() => parseGameData(raw)).toThrow(/duplicate stars/);
  });
});

describe('applyDifficulty', () => {
  it('is identity on every shipped wave for Normal', () => {
    for (const wave of data.waves.waves) {
      expect(applyDifficulty(wave, 'normal', data)).toEqual(wave);
    }
  });

  it('same seed + Normal pendingSpawns match overlay-skipped rollWave', () => {
    const seed = 'identity-seed';
    const state = newRun(seed, 'normal');
    const expected = rollWave(data.waves.waves[0]!, createStreams(seed).wave, data.robots);
    expect(state.pendingSpawns).toEqual(expected.spawns.slice(state.board.robots.length));
    expect([...state.board.robots.map((r) => r.hp), ...state.pendingSpawns.map((s) => s.hp)]).toEqual(
      expected.spawns.map((s) => s.hp),
    );
  });

  it('Easy vs Normal, same seed: non-Boss HP ≤ Normal, smaller procedural count, Boss 1000, waves 1–7 templates match', () => {
    const seed = 'compare-easy';
    const easyRun = newRun(seed, 'easy');
    const normalRun = newRun(seed, 'normal');
    expect(easyRun.pendingSpawns.map((spawn) => spawn.robotTemplateId)).toEqual(
      normalRun.pendingSpawns.map((spawn) => spawn.robotTemplateId),
    );
    const easyHps = [
      ...easyRun.board.robots.map((robot) => robot.hp),
      ...easyRun.pendingSpawns.map((spawn) => spawn.hp),
    ];
    const normalHps = [
      ...normalRun.board.robots.map((robot) => robot.hp),
      ...normalRun.pendingSpawns.map((spawn) => spawn.hp),
    ];
    for (let i = 0; i < easyHps.length; i += 1) {
      expect(easyHps[i]!).toBeLessThanOrEqual(normalHps[i]!);
    }

    const easy = applyDifficulty(data.waves.waves[0]!, 'easy', data);
    const normal = applyDifficulty(data.waves.waves[0]!, 'normal', data);
    expect('spawns' in easy && 'spawns' in normal).toBe(true);
    if ('spawns' in easy && 'spawns' in normal) {
      expect(easy.spawns.map((s) => s.robot)).toEqual(normal.spawns.map((s) => s.robot));
      for (let i = 0; i < easy.spawns.length; i += 1) {
        expect(easy.spawns[i]!.hp[1]).toBeLessThanOrEqual(normal.spawns[i]!.hp[1]);
      }
    }

    const easyCounts = overlayCounts('easy');
    const normalCounts = overlayCounts('normal');
    expect(easyCounts.some((count, i) => count < normalCounts[i]!)).toBe(true);

    const boss = data.waves.waves.find((wave) => 'spawns' in wave && wave.spawns.some((s) => s.robot === 'boss'));
    expect(boss && 'spawns' in boss).toBe(true);
    if (boss && 'spawns' in boss) {
      const easyBoss = applyDifficulty(boss, 'easy', data);
      const spawn = 'spawns' in easyBoss ? easyBoss.spawns.find((s) => s.robot === 'boss') : undefined;
      expect(spawn?.hp).toEqual([1000, 1000]);
    }

    for (let i = 0; i < 7; i += 1) {
      const e = applyDifficulty(data.waves.waves[i]!, 'easy', data);
      const n = applyDifficulty(data.waves.waves[i]!, 'normal', data);
      if ('spawns' in e && 'spawns' in n) {
        expect(e.spawns.map((s) => s.robot)).toEqual(n.spawns.map((s) => s.robot));
      }
    }
  });

  it('Hard vs Normal, same seed: larger procedural count, no basic on 8–9, waves 1–7 templates match, Hard non-Boss HP ≥ Normal', () => {
    const hardCounts = overlayCounts('hard');
    const normalCounts = overlayCounts('normal');
    expect(hardCounts.some((count, i) => count > normalCounts[i]!)).toBe(true);

    for (const wave of data.waves.waves.filter((w) => 'procedural' in w)) {
      const overlaid = applyDifficulty(wave, 'hard', data);
      if ('procedural' in overlaid) {
        for (const group of overlaid.procedural.groups) {
          expect(group.pool).not.toContain('basic');
        }
      }
    }

    let sawHigherHp = false;
    for (let i = 0; i < 7; i += 1) {
      const h = applyDifficulty(data.waves.waves[i]!, 'hard', data);
      const n = applyDifficulty(data.waves.waves[i]!, 'normal', data);
      if ('spawns' in h && 'spawns' in n) {
        expect(h.spawns.map((s) => s.robot)).toEqual(n.spawns.map((s) => s.robot));
        for (let j = 0; j < h.spawns.length; j += 1) {
          expect(h.spawns[j]!.hp[0]).toBeGreaterThanOrEqual(n.spawns[j]!.hp[0]);
          expect(h.spawns[j]!.hp[1]).toBeGreaterThanOrEqual(n.spawns[j]!.hp[1]);
          if (h.spawns[j]!.hp[1] > n.spawns[j]!.hp[1]) sawHigherHp = true;
        }
      }
    }
    expect(sawHigherHp, 'Hard non-Boss HP should exceed Normal on waves 1–7').toBe(true);
  });

  it('is deterministic: same seed + difficulty → identical pendingSpawns', () => {
    expect(newRun('det', 'easy').pendingSpawns).toEqual(newRun('det', 'easy').pendingSpawns);
    expect(newRun('det', 'hard').pendingSpawns).toEqual(newRun('det', 'hard').pendingSpawns);
  });

  it('drawing from shop does not change Easy/Hard rolls', () => {
    const seed = 'shop-stream';
    const wave = applyDifficulty(data.waves.waves[7]!, 'hard', data);
    const streams = createStreams(seed);
    const [, shopAfter] = nextInt(streams.shop, 0, 99);
    const rolled = rollWave(wave, streams.wave, data.robots);
    const again = rollWave(wave, createStreams(seed).wave, data.robots);
    expect(rolled.spawns).toEqual(again.spawns);
    expect(shopAfter).not.toEqual(streams.shop);
  });

  it('newRun without difficulty writes normal', () => {
    const state = newRun('omit');
    expect(state.difficulty).toBe('normal');
    expect(state).toEqual(newRun('omit', 'normal'));
  });

  it('shop offers for a seed are identical across difficulties', () => {
    for (const seed of ['1', '7', '42']) {
      const easy = newRun(seed, 'easy');
      const normal = newRun(seed, 'normal');
      const hard = newRun(seed, 'hard');
      expect(easy.rng.shop).toEqual(normal.rng.shop);
      expect(hard.rng.shop).toEqual(normal.rng.shop);
      expect(rollShop(1, easy, data).offers).toEqual(rollShop(1, normal, data).offers);
      expect(rollShop(1, hard, data).offers).toEqual(rollShop(1, normal, data).offers);
    }
  });
});
