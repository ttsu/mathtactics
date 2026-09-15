// The `presentation.json` `pacing` and `playback` blocks (task 10) for hand-built fake `GameData`
// fixtures — one copy, so a new playback setting is added in one place (same pattern as
// ./dragSettings).
export function fakePacingSettings() {
  return {
    ballCellDurationMs: 200,
    exitBallCellDurationMs: 50,
    perTilePauseMs: 100,
    laneGapMs: 300,
    advanceDurationMs: 400,
  };
}

export function fakePlaybackSettings() {
  return {
    beats: {
      laneStartMs: 10,
      ballFireMs: 20,
      impactMs: 30,
      blockedMs: 40,
      bounceBackMs: 50,
      defeatMs: 60,
      exactKillMs: 70,
      coinsMs: 80,
      exitMs: 90,
      laneEndMs: 5,
    },
    beatShares: { quick: 0.25, grow: 0.4, half: 0.5, most: 0.7, fade: 0.3 },
    lane: { dimAlpha: 0.3 },
    cannon: { thumpScale: 1.2 },
    ball: { fireFromScale: 0.3 },
    transform: {
      popScale: 1.3,
      popScalePerChain: 0.15,
      popScaleMax: 2,
      tilePopScale: 1.1,
      tileFlashAlpha: 0.7,
      ballHopPt: 60,
    },
    impact: {
      knockbackPt: 16,
      damageFloatPt: 70,
      doubledDamageScale: 1.3,
      shakeMs: 180,
      shakePerDamage: 0.001,
      shakeMax: 0.01,
    },
    blocked: {
      bounceOffPt: 60,
      robotWobblePt: 8,
      robotWobbleRepeats: 2,
      shakeMs: 160,
      shake: 0.004,
    },
    bounceBack: { wobbleScale: 1.2, maxBarFill: 1.2 },
    defeat: { popScale: 1.2, puffScale: 1.6 },
    exactKill: {
      popScale: 1.7,
      starCount: 12,
      starBurstPt: 190,
      starSpinDeg: 180,
      bigStarSpinDeg: 360,
      bigStarScale: 2.4,
      ringScale: 3,
      shakeMs: 320,
      shake: 0.014,
    },
    coins: { floatPt: 60 },
    exit: { rollPt: 160, rollSpinDeg: 360 },
  };
}
