import { describe, expect, it } from 'vitest';
import { transformEffect } from '../../game/board/playback/transformEffect';
import { fakePlaybackSettings } from '../helpers/playbackSettings';
import { realData } from './boardFixtures';

const fake = fakePlaybackSettings().transform;

describe('transformEffect', () => {
  it('uses the additive strength for + and − tiles', () => {
    for (const tileId of ['add:2', 'sub:3'] as const) {
      const effect = transformEffect({ tileId, chainDepth: 1 }, fake);
      expect(effect).toMatchObject({ ...fake.additive, multiply: false });
      expect(effect.ballPopScale).toBe(fake.popScale);
    }
  });

  it('uses the stronger multiply strength for × tiles, on top of the same chain pop', () => {
    const effect = transformEffect({ tileId: 'mul:3', chainDepth: 1 }, fake);
    expect(effect).toMatchObject({ ...fake.multiply, multiply: true });
    expect(effect.ballPopScale).toBe(fake.popScale + fake.multiply.popBonus);
  });

  it('escalates the ball pop along a chain up to the cap, keeping the × bonus above it', () => {
    const pops = [1, 2, 3, 20].map(
      (chainDepth) => transformEffect({ tileId: 'add:1', chainDepth }, fake).ballPopScale,
    );
    expect(pops[1]).toBeGreaterThan(pops[0]!);
    expect(pops[2]).toBeGreaterThan(pops[1]!);
    expect(pops[3]).toBe(fake.popScaleMax);
    expect(transformEffect({ tileId: 'mul:2', chainDepth: 20 }, fake).ballPopScale).toBe(
      fake.popScaleMax + fake.multiply.popBonus,
    );
  });

  it('the real presentation.json makes × clearly stronger than + / −', () => {
    const settings = realData.presentation.playback.transform;
    const add = transformEffect({ tileId: 'add:2', chainDepth: 1 }, settings);
    const mul = transformEffect({ tileId: 'mul:2', chainDepth: 1 }, settings);
    expect(mul.ballPopScale).toBeGreaterThan(add.ballPopScale);
    expect(mul.labelScale).toBeGreaterThan(add.labelScale);
    expect(mul.ringScale).toBeGreaterThan(add.ringScale);
    expect(mul.ringCount).toBeGreaterThan(add.ringCount);
    expect(mul.sparkCount).toBeGreaterThan(add.sparkCount);
    expect(mul.shake).toBeGreaterThan(add.shake);
    expect(realData.presentation.pacing.multiplyTilePauseMs).toBeGreaterThan(
      realData.presentation.pacing.perTilePauseMs,
    );
  });
});
