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
  continueToNextLevel,
  firstLevelId,
  levelPosition,
  nextLevelId,
  playFromStart,
  showLevelCleared,
  startLevel,
} from './levelFlow';
export type { LevelPosition } from './levelFlow';
export {
  scopedKey,
  saveRun,
  loadRun,
  loadSeen,
  addSeen,
  addSeenMany,
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} from './storage';
export type { StorageLike, Settings } from './storage';
export {
  createAppStore,
  stubApplyCommand,
  displayFromRun,
  isPlaybackActive,
  canReplay,
  IDLE_PLAYBACK,
  NO_SHOP_NEW,
} from './store';
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
  LastTurn,
} from './store';
export { tileFace } from './tileFace';
export type { TileFace, TileColorKey } from './tileFace';
export { shopCardStatus } from './shopCard';
export type { ShopCardStatus } from './shopCard';
// `createTestHandle`/`installTestHandle`/`TestHandle` are deliberately NOT re-exported here
// (finding 9, final review) — barrel-exporting them would invite a static `import { ... } from
// '../state'` that defeats game/main.tsx's guarded dynamic `import('./state/testHandle')`
// (TR §14), pulling the test handle into every build. Import directly from
// `./testHandle` (or `../../game/state/testHandle` from tests) instead.
