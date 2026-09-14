export {
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
  HUD_BAR,
  MIN_TOUCH_TARGET,
  placementOverCanvas,
} from './designSpace';
export type { Rect, DesignSpacePlacement } from './designSpace';
export { getAudioContext, installAudioUnlock } from './audio';
export { gameData } from './gameData';
export {
  scopedKey,
  saveRun,
  loadRun,
  loadSeen,
  addSeen,
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} from './storage';
export type { StorageLike, Settings } from './storage';
export { createAppStore, stubApplyCommand, displayFromRun, IDLE_PLAYBACK } from './store';
export type {
  AppState,
  AppActions,
  AppStore,
  ApplyCommandFn,
  ApplyCommandResult,
  CreateAppStoreOptions,
  Display,
  Screen,
  Playback,
} from './store';
// `createTestHandle`/`installTestHandle`/`TestHandle` are deliberately NOT re-exported here
// (finding 9, final review) — barrel-exporting them would invite a static `import { ... } from
// '../state'` that defeats game/main.tsx's guarded dynamic `import('./state/testHandle')`
// (TR §14), pulling the test handle into every build. Import directly from
// `./testHandle` (or `../../game/state/testHandle` from tests) instead.
