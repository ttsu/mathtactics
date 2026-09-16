import { describe, expect, it } from 'vitest';
import {
  FRAME_BACKDROP,
  frameBackdropGradient,
  frameBackdropPlacement,
  hudBandPercent,
} from '../../game/state/frameBackdrop';
import { HUD_BAR, DESIGN_HEIGHT } from '../../game/state/designSpace';

describe('frameBackdropPlacement', () => {
  it('returns null when the canvas fills the viewport width', () => {
    expect(frameBackdropPlacement({ top: 0, width: 1180, height: 820 }, 1180)).toBeNull();
    expect(frameBackdropPlacement({ top: 0, width: 844, height: 390 }, 844)).toBeNull();
  });

  it('fills horizontal letterboxing at 1600×900', () => {
    const width = (900 * 1180) / 820;
    const left = (1600 - width) / 2;
    expect(frameBackdropPlacement({ top: 0, width, height: 900 }, 1600)).toEqual({
      top: 0,
      height: 900,
      hudStopPercent: hudBandPercent(),
    });
    expect(left).toBeGreaterThan(0);
  });
});

describe('hudBandPercent', () => {
  it('matches the HUD bar share of the design space', () => {
    expect(hudBandPercent()).toBeCloseTo((HUD_BAR.height / DESIGN_HEIGHT) * 100, 10);
  });
});

describe('frameBackdropGradient', () => {
  it('splits HUD and board colours at the HUD band', () => {
    const placement = { top: 0, height: 820, hudStopPercent: 10.73170731707317 };
    expect(frameBackdropGradient(placement)).toBe(
      `linear-gradient(to bottom, ${FRAME_BACKDROP.hud} 10.73170731707317%, ${FRAME_BACKDROP.board} 10.73170731707317%)`,
    );
  });
});
