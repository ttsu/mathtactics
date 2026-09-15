// The `presentation.json` `drag` block (task 09) for hand-built fake `GameData` fixtures — one
// copy, so a new drag setting is added in one place.
export function fakeDragSettings() {
  return {
    liftScale: 1.15,
    liftDurationMs: 80,
    fingerOffsetPt: 36,
    snapRadiusCells: 0.75,
    settleDurationMs: 160,
    trayScrollThresholdPt: 12,
  };
}

/** The `presentation.json` `screens` block (task 11; task 16 adds the reward/icon staggers and
 * the lose screen's dance timing) for hand-built fake `GameData` fixtures. */
export function fakeScreenSettings() {
  return {
    popInMs: 450,
    rewardStaggerMs: 180,
    iconStaggerMs: 90,
    danceMs: 900,
    danceStaggerMs: 150,
  };
}
