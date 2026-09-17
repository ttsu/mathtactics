import { describe, expect, it } from 'vitest';
import { createStreams, nextInt, seedRng, type RngState } from '../../../sim/core/rng';
import type { WaveDef } from '../../../sim/data/schemas';
import { parseGameData } from '../../../sim/data/load';
import { rollShop } from '../../../sim/shop/rollShop';
import { rollWave } from '../../../sim/waves/rollWave';
import { fakeRunState } from '../commands/fixtures';
import { loadRawGameData } from '../../helpers/loadDataFiles';

type AuthoredWave = Extract<WaveDef, { spawns: unknown }>;
type SpawnDef = AuthoredWave['spawns'][number];
type ProceduralWave = Extract<WaveDef, { procedural: unknown }>;
type ProceduralGroup = ProceduralWave['procedural']['groups'][number];

function spawnDef(overrides: Partial<SpawnDef> = {}): SpawnDef {
  return { turn: 1, lane: 'A', robot: 'basic', hp: [1, 3], ...overrides };
}

function waveDef(spawns: SpawnDef[]): AuthoredWave {
  return { id: 'wave-test', spawns };
}

function procGroup(overrides: Partial<ProceduralGroup> = {}): ProceduralGroup {
  return {
    turn: 1,
    count: 3,
    hp: [10, 20],
    pool: ['weakness-5', 'bounce-back', 'odd-only', 'even-only', 'basic'],
    ...overrides,
  };
}

function procWave(groups: ProceduralGroup[]): ProceduralWave {
  return { id: 'wave-proc', procedural: { groups } };
}

const SEEDS = Array.from({ length: 200 }, (_, i) => `seed-${i}`);

describe('rollWave', () => {
  it('is deterministic: the same seed gives deep-equal output', () => {
    const wave = waveDef([
      spawnDef({ lane: 'A', hp: [4, 10] }),
      spawnDef({ turn: 5, lane: 'B', hp: [4, 10] }),
      spawnDef({ turn: 9, lane: 'C', hp: [4, 10] }),
    ]);
    expect(rollWave(wave, seedRng('run-1'))).toEqual(rollWave(wave, seedRng('run-1')));
  });

  it('follows the TR §6 draw order: letters by first appearance over free lanes, then HP in file order', () => {
    const wave = waveDef([
      spawnDef({ turn: 3, lane: 'B', hp: [1, 9] }),
      spawnDef({ turn: 1, lane: 2, hp: [5, 5] }),
      spawnDef({ turn: 1, lane: 'A', hp: [10, 20] }),
      spawnDef({ turn: 2, lane: 'B', hp: [30, 40] }),
    ]);
    let rng: RngState = seedRng('draw-order');
    const draw = (min: number, max: number) => {
      const [value, next] = nextInt(rng, min, max);
      rng = next;
      return value;
    };
    // B appears first: free lanes are 0, 1, 3, 4 (2 is fixed).
    const freeForB = [0, 1, 3, 4];
    const laneB = freeForB[draw(0, 3)]!;
    const freeForA = freeForB.filter((lane) => lane !== laneB);
    const laneA = freeForA[draw(0, 2)]!;
    const hps = [draw(1, 9), draw(5, 5), draw(10, 20), draw(30, 40)];

    const result = rollWave(wave, seedRng('draw-order'));

    expect(result.spawns).toEqual([
      { turn: 1, lane: 2, robotTemplateId: 'basic', hp: hps[1] },
      { turn: 1, lane: laneA, robotTemplateId: 'basic', hp: hps[2] },
      { turn: 2, lane: laneB, robotTemplateId: 'basic', hp: hps[3] },
      { turn: 3, lane: laneB, robotTemplateId: 'basic', hp: hps[0] },
    ]);
    expect(result.rng).toEqual(rng);
  });

  it('puts letters A, B, C on three different lanes, and a repeated letter on the same lane', () => {
    const wave = waveDef([
      spawnDef({ lane: 'A' }),
      spawnDef({ turn: 4, lane: 'B' }),
      spawnDef({ turn: 7, lane: 'C' }),
      spawnDef({ turn: 8, lane: 'A' }),
    ]);
    for (const seed of SEEDS) {
      const { spawns } = rollWave(wave, seedRng(seed));
      const [a, b, c, a2] = spawns.map((spawn) => spawn.lane);
      expect(new Set([a, b, c]).size).toBe(3);
      expect(a2).toBe(a);
    }
  });

  it('never puts a letter on a lane fixed in the same wave', () => {
    const wave = waveDef([
      spawnDef({ lane: 1 }),
      spawnDef({ lane: 3 }),
      spawnDef({ turn: 2, lane: 'A' }),
      spawnDef({ turn: 2, lane: 'B' }),
      spawnDef({ turn: 2, lane: 'C' }),
    ]);
    for (const seed of SEEDS) {
      const letterLanes = rollWave(wave, seedRng(seed))
        .spawns.filter((s) => s.turn === 2)
        .map((s) => s.lane);
      expect(letterLanes.sort()).toEqual([0, 2, 4]);
    }
  });

  it('uses every free lane for a letter over many seeds (not stuck on one lane)', () => {
    const wave = waveDef([spawnDef({ lane: 'A' })]);
    const seen = new Set(SEEDS.map((seed) => rollWave(wave, seedRng(seed)).spawns[0]!.lane));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('rolls every HP within its range', () => {
    const wave = waveDef([
      spawnDef({ lane: 'A', hp: [1, 3] }),
      spawnDef({ lane: 'B', hp: [4, 10] }),
      spawnDef({ lane: 0, hp: [99, 99] }),
    ]);
    const ranges = wave.spawns.map((spawn) => spawn.hp);
    for (const seed of SEEDS) {
      rollWave(wave, seedRng(seed)).spawns.forEach((spawn, index) => {
        const [min, max] = ranges[index]!;
        expect(spawn.hp).toBeGreaterThanOrEqual(min);
        expect(spawn.hp).toBeLessThanOrEqual(max);
      });
    }
  });

  it('sorts by turn, keeping file order within a turn', () => {
    const wave = waveDef([
      spawnDef({ turn: 6, lane: 0, hp: [6, 6] }),
      spawnDef({ turn: 1, lane: 1, hp: [1, 1] }),
      spawnDef({ turn: 6, lane: 2, hp: [7, 7] }),
      spawnDef({ turn: 1, lane: 3, hp: [2, 2] }),
    ]);
    const { spawns } = rollWave(wave, seedRng('sorted'));
    expect(spawns.map((spawn) => [spawn.turn, spawn.hp])).toEqual([
      [1, 1],
      [1, 2],
      [6, 6],
      [6, 7],
    ]);
  });

  it('does not mutate the input state', () => {
    const rng = seedRng('pure');
    const before = [...rng];
    rollWave(waveDef([spawnDef()]), rng);
    expect(rng).toEqual(before);
  });
});

describe('rollWave — procedural', () => {
  const data = parseGameData(loadRawGameData());

  it('is deterministic: the same seed gives the same lanes, templates, and HP', () => {
    const wave = procWave([procGroup(), procGroup({ turn: 8, count: 3, hp: [40, 65] })]);
    expect(rollWave(wave, seedRng('proc-same'))).toEqual(rollWave(wave, seedRng('proc-same')));
  });

  it('follows the TR §9 draw order: lanes, then per lane pool without replacement and HP', () => {
    const group = procGroup({
      turn: 1,
      count: 3,
      hp: [10, 20],
      pool: ['weakness-5', 'bounce-back', 'odd-only', 'even-only', 'basic'],
    });
    const wave = procWave([group]);
    let rng: RngState = seedRng('proc-draw-order');
    const draw = (min: number, max: number) => {
      const [value, next] = nextInt(rng, min, max);
      rng = next;
      return value;
    };

    const remainingLanes = [0, 1, 2, 3, 4];
    const drawnLanes: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const index = draw(0, remainingLanes.length - 1);
      drawnLanes.push(remainingLanes.splice(index, 1)[0]!);
    }
    const remainingPool = [...group.pool];
    const expected = drawnLanes.map((lane) => {
      const poolIndex = draw(0, remainingPool.length - 1);
      const robotTemplateId = remainingPool.splice(poolIndex, 1)[0]!;
      const hp = draw(10, 20);
      return { turn: 1, lane, robotTemplateId, hp };
    });

    const result = rollWave(wave, seedRng('proc-draw-order'));
    expect(result.spawns).toEqual(expected);
    expect(result.rng).toEqual(rng);
  });

  it('drawing from shop does not change a procedural wave', () => {
    const wave = procWave([procGroup()]);
    const streams = createStreams('shop-isolation');
    const shopState = fakeRunState({ rng: streams });
    rollShop(1, shopState, data);
    expect(rollWave(wave, streams.wave)).toEqual(
      rollWave(wave, createStreams('shop-isolation').wave),
    );
  });

  it('count: 3 always yields 3 distinct lanes', () => {
    const wave = procWave([procGroup({ count: 3 })]);
    for (const seed of SEEDS) {
      const { spawns } = rollWave(wave, seedRng(seed));
      expect(spawns).toHaveLength(3);
      expect(new Set(spawns.map((spawn) => spawn.lane)).size).toBe(3);
    }
  });

  it('a group never repeats a template', () => {
    const wave = procWave([
      procGroup({ count: 3 }),
      procGroup({
        turn: 8,
        count: 3,
        hp: [40, 65],
        pool: ['weakness-2', 'weakness-10', 'even-only', 'bounce-back', 'basic'],
      }),
    ]);
    for (const seed of SEEDS) {
      const { spawns } = rollWave(wave, seedRng(seed));
      const turn1 = spawns.filter((spawn) => spawn.turn === 1);
      const turn8 = spawns.filter((spawn) => spawn.turn === 8);
      expect(new Set(turn1.map((spawn) => spawn.robotTemplateId)).size).toBe(turn1.length);
      expect(new Set(turn8.map((spawn) => spawn.robotTemplateId)).size).toBe(turn8.length);
    }
  });

  it('sorts groups by turn', () => {
    const wave = procWave([
      procGroup({ turn: 8, count: 1, hp: [4, 4], pool: ['basic'] }),
      procGroup({ turn: 1, count: 1, hp: [3, 3], pool: ['odd-only'] }),
    ]);
    const { spawns } = rollWave(wave, seedRng('sorted-proc'));
    expect(spawns.map((spawn) => [spawn.turn, spawn.robotTemplateId])).toEqual([
      [1, 'odd-only'],
      [8, 'basic'],
    ]);
  });
});
