// Hidden debug menu: state helpers. Panels and gestures live in `/game/ui/debug`; adding a
// future option is: a pure function here + a panel in `DEBUG_PANELS`.

export {
  DEBUG_HP_PRESETS,
  debugAddRobot,
  debugAddTile,
  debugJumpToLevel,
  debugJumpToWave,
  defaultDebugHp,
  ensureRun,
  makeDebugSeed,
} from './actions';
export type { DebugResult } from './actions';
export {
  buildDebugSnapshot,
  DEBUG_SNAPSHOT_KIND,
  DEBUG_SNAPSHOT_VERSION,
  parseDebugSnapshot,
  stringifyDebugSnapshot,
  summarizeRun,
} from './snapshot';
export type { DebugSnapshot, ParseSnapshotResult, SnapshotSource } from './snapshot';
export {
  DEBUG_TRIGGERS,
  isDebugHotkey,
  longPressHeld,
  queryWantsDebug,
  recordTapSequence,
  shakeStep,
} from './triggers';
export type {
  ShakeResult,
  ShakeSample,
  ShakeState,
  TapSequenceResult,
  TapSequenceState,
} from './triggers';
