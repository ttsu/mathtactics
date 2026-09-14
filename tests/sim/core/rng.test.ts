import { describe, expect, it } from 'vitest';
import {
  createStreams,
  nextInt,
  pickWeighted,
  seedRng,
  type RngState,
} from '../../../sim/core/rng';

function drawInts(state: RngState, count: number, min: number, max: number): number[] {
  const values: number[] = [];
  let s = state;
  for (let i = 0; i < count; i += 1) {
    const [value, next] = nextInt(s, min, max);
    values.push(value);
    s = next;
  }
  return values;
}

describe('rng determinism', () => {
  it('produces the same sequence for the same seed', () => {
    const a = drawInts(seedRng('run-42'), 50, 1, 100);
    const b = drawInts(seedRng('run-42'), 50, 1, 100);
    expect(a).toEqual(b);
  });

  it('produces a different sequence for a different seed', () => {
    const a = drawInts(seedRng('run-42'), 50, 1, 100);
    const b = drawInts(seedRng('run-43'), 50, 1, 100);
    expect(a).not.toEqual(b);
  });

  it('advancing the state changes the next draw (no repeats within one sequence, usually)', () => {
    const [first, s1] = nextInt(seedRng('seed'), 1, 1000000);
    const [second] = nextInt(s1, 1, 1000000);
    expect(first).not.toBe(second);
  });

  it('is pure: drawing from a state twice gives the same result both times', () => {
    const state = seedRng('pure-check');
    const [a] = nextInt(state, 1, 10);
    const [b] = nextInt(state, 1, 10);
    expect(a).toBe(b);
  });
});

describe('nextInt', () => {
  it('stays within an inclusive [min, max] range over many draws', () => {
    let state = seedRng('range-check');
    for (let i = 0; i < 1000; i += 1) {
      const [value, next] = nextInt(state, 5, 8);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThanOrEqual(8);
      expect(Number.isInteger(value)).toBe(true);
      state = next;
    }
  });

  it('handles a single-value range', () => {
    const [value] = nextInt(seedRng('single'), 7, 7);
    expect(value).toBe(7);
  });

  it('rejects an inverted range', () => {
    expect(() => nextInt(seedRng('bad'), 5, 1)).toThrow(RangeError);
  });
});

describe('pickWeighted', () => {
  it('only ever returns items with positive weight, roughly matching their share over many draws', () => {
    let state = seedRng('weighted');
    const counts = { a: 0, b: 0, c: 0 };
    const items = [
      { item: 'a' as const, weight: 1 },
      { item: 'b' as const, weight: 0 },
      { item: 'c' as const, weight: 3 },
    ];
    const draws = 4000;
    for (let i = 0; i < draws; i += 1) {
      const [picked, next] = pickWeighted(state, items);
      counts[picked] += 1;
      state = next;
    }
    expect(counts.b).toBe(0);
    // c has 3x the weight of a; allow generous statistical slack.
    const ratio = counts.c / counts.a;
    expect(ratio).toBeGreaterThan(2);
    expect(ratio).toBeLessThan(4.5);
  });

  it('is deterministic for a given state', () => {
    const state = seedRng('weighted-deterministic');
    const items = [
      { item: 'x', weight: 1 },
      { item: 'y', weight: 1 },
    ];
    const [a] = pickWeighted(state, items);
    const [b] = pickWeighted(state, items);
    expect(a).toBe(b);
  });

  it('rejects an empty item list', () => {
    expect(() => pickWeighted(seedRng('empty'), [])).toThrow(RangeError);
  });

  it('rejects an all-zero-weight item list', () => {
    expect(() =>
      pickWeighted(seedRng('zero'), [
        { item: 'a', weight: 0 },
        { item: 'b', weight: 0 },
      ]),
    ).toThrow(RangeError);
  });
});

describe('createStreams: stream independence (TR §8)', () => {
  it('gives wave and shop distinct initial states', () => {
    const streams = createStreams('run-seed');
    expect(streams.wave).not.toEqual(streams.shop);
  });

  it('drawing from shop never advances wave (purchases must not affect wave RNG)', () => {
    const streams = createStreams('run-seed');
    const [firstWaveDraw] = nextInt(streams.wave, 1, 1000);

    // Draw many times from `shop` only.
    let shop = streams.shop;
    for (let i = 0; i < 25; i += 1) {
      [, shop] = nextInt(shop, 1, 1000);
    }

    // `wave` state is untouched by any of the shop draws above.
    const [secondWaveDraw] = nextInt(streams.wave, 1, 1000);
    expect(secondWaveDraw).toBe(firstWaveDraw);
  });

  it('is deterministic per seed', () => {
    const a = createStreams('same-seed');
    const b = createStreams('same-seed');
    expect(a).toEqual(b);
  });
});
