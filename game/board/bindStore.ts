// Phaser binding for the app store (TR §10, task 05 req. 2): subscribes a scene to store
// changes and unsubscribes automatically when the scene shuts down, so a scene restart (or the
// game tearing down) never leaves a stale listener attached to the store.
//
// Structurally typed against the store/scene shapes it actually uses (rather than importing the
// full `AppStore`/`Phaser.Scene` types) so it stays generic and is unit-testable with plain fake
// objects, no real Phaser instance required. Deliberately does NOT `import Phaser from 'phaser'`
// at module scope — the Phaser package touches `window` on import and crashes under vitest's
// node environment (verified); `SCENE_SHUTDOWN_EVENT` instead mirrors the literal Phaser 4 uses
// (node_modules/phaser/src/scene/events/SHUTDOWN_EVENT.js: `module.exports = 'shutdown'`,
// also `Phaser.Scenes.Events.SHUTDOWN` in the public types) rather than importing it.

/** Same string as `Phaser.Scenes.Events.SHUTDOWN` — see module comment for why it's inlined. */
export const SCENE_SHUTDOWN_EVENT = 'shutdown';

export interface SceneLike {
  events: {
    once(event: string, listener: () => void): unknown;
  };
}

export interface SubscribableStore<T> {
  subscribe(listener: (state: T, previousState: T) => void): () => void;
}

/**
 * Subscribes `listener` to `store`, tied to `scene`'s lifetime: the subscription is torn down
 * on the Scene Systems Shutdown event (`this.events.on('shutdown', ...)`, Phaser 4 —
 * `Phaser.Scenes.Events.SHUTDOWN`). Returns the unsubscribe function directly too, for callers
 * that want to tear it down earlier.
 */
export function bindStore<T>(
  scene: SceneLike,
  store: SubscribableStore<T>,
  listener: (state: T, previousState: T) => void,
): () => void {
  const unsubscribe = store.subscribe(listener);
  scene.events.once(SCENE_SHUTDOWN_EVENT, unsubscribe);
  return unsubscribe;
}
