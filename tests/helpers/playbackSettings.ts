// The `presentation.json` `pacing` and `playback` blocks (task 10) for hand-built fake `GameData`
// fixtures — one copy, so a new playback setting is added in one place (same pattern as
// ./dragSettings).
export function fakePacingSettings() {
  return {
    ballCellDurationMs: 200,
    exitBallCellDurationMs: 50,
    perTilePauseMs: 100,
    multiplyTilePauseMs: 200,
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
      detonateMs: 100,
      baseCountDownMs: 110,
      spawnMs: 70,
      endMs: 120,
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
      effectMs: 500,
      additive: {
        popBonus: 0,
        labelFloatPt: 60,
        labelScale: 1.1,
        ringCount: 1,
        ringScale: 1.8,
        sparkCount: 0,
        sparkBurstPt: 0,
        wobbleDeg: 0,
        shakeMs: 0,
        shake: 0,
      },
      multiply: {
        popBonus: 0.4,
        labelFloatPt: 90,
        labelScale: 1.5,
        ringCount: 2,
        ringScale: 2.5,
        sparkCount: 8,
        sparkBurstPt: 80,
        wobbleDeg: 12,
        shakeMs: 120,
        shake: 0.005,
      },
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
      shieldWobblePt: 6,
      shieldWobbleRepeats: 2,
      shakeMs: 0,
      shake: 0,
    },
    bounceBack: {
      wobbleScale: 1.12,
      maxBarFill: 1.15,
      remainderLandPt: 28,
      remainderPopScale: 1.35,
      plusCount: 12,
      plusFloatPt: 36,
      plusSpreadPt: 40,
      plusColor: '#66bb6a',
    },
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
    detonate: {
      shakeMs: 100,
      shake: 0.01,
      heartTargetX: 200,
      heartTargetY: 40,
      heartLabelScale: 0.55,
    },
    spawn: {
      dropFromPt: 90,
      dropFromScale: 0.5,
      ghostAlpha: 0.45,
      ghostPopFromScale: 0.6,
    },
  };
}

/** The `presentation.json` `danger` block (task 15) for hand-built fake `GameData` fixtures. */
export function fakeDangerSettings() {
  return {
    pulseMs: 100,
    minAlpha: 0.2,
    maxAlpha: 0.6,
    color: '#e53935',
    wobbleDeg: 6,
    wobbleMs: 80,
  };
}

/** The `presentation.json` `hud` block (▶ Go colour and idle nudge) for fake `GameData`. */
export function fakeHudSettings() {
  return {
    goColor: '#43a047',
    goNudgeIdleMs: 10000,
    goNudgeWiggleMs: 2400,
    goNudgeWiggleDeg: 8,
  };
}

/** The `presentation.json` `traits` block (task 23 telegraph colours) for fake `GameData`. */
export function fakeTraitSettings() {
  return {
    weaknessNColor: '#ffd54f',
    weaknessMarkColor: '#e53935',
    oddShieldColor: '#7e57c2',
    evenShieldColor: '#26a69a',
    bounceBackBodyColor: '#ef6c00',
  };
}

/** The `presentation.json` `boss` block. `scale` 1 fills the 2×2 with the same outer margin as a 1×1. */
export function fakeBossSettings() {
  return { scale: 1 };
}

/** Planning-hint numerals under tiles (task 24, GDD §5.7). Presentation only. */
export function fakeHintsSettings() {
  return {
    color: '#2f3e57',
  };
}

/** The `presentation.json` `audio` block (task 31) for hand-built fake `GameData` fixtures. */
export function fakeAudioSettings() {
  return {
    maxVoices: 8,
    impactDoubledGain: 1.3,
    tilePop: {
      depthRatio: 1.122462048309373,
      add: { baseHz: 500, offsetSemitones: 2 },
      sub: { baseHz: 400, offsetSemitones: -2 },
      mul: { baseHz: 600, offsetSemitones: 4 },
    },
    foley: {
      theme: 'mechanical' as const,
      volume: 0.7,
      space: 0.04,
      cues: {
        uiTap: { name: 'tap' as const },
        preview: { name: 'on' as const },
        pickupTile: { name: 'tap' as const },
        pickupCannon: { name: 'tap' as const, pitch: -7 },
        dropTile: { name: 'thock' as const },
        dropCannon: { name: 'thock' as const, pitch: -5 },
        snapBack: { name: 'denied' as const },
        trayTick: { name: 'tick' as const, volume: 0.45 },
        cannonThump: { name: 'press' as const, pitch: -10 },
        tilePop: { name: 'chime' as const, theme: 'default' as const },
        impact: { name: 'press' as const },
        kill: { name: 'pop' as const, volume: 0.55 },
        exactKill: { name: 'sparkle' as const },
        bounceBack: { name: 'rise' as const },
        clonk: { name: 'thock' as const, pitch: -8 },
        detonate: { name: 'drop' as const, pitch: -12 },
        spawn: { name: 'drop' as const },
        buy: { name: 'success' as const },
        nope: { name: 'error' as const },
        waveCleared: { name: 'complete' as const, volume: 0.45 },
        win: { name: 'chime' as const },
        lose: { name: 'off' as const },
      },
    },
  };
}
