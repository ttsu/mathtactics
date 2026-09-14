import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  SCENE_SHUTDOWN_EVENT,
  bindStore,
  type SceneLike,
  type SubscribableStore,
} from '../../game/board/bindStore';

function fakeScene(): { scene: SceneLike; shutdown: () => void } {
  const listeners = new Map<string, () => void>();
  const scene: SceneLike = {
    events: {
      once: (event, listener) => {
        listeners.set(event, listener);
        return scene.events;
      },
    },
  };
  return {
    scene,
    shutdown: () => listeners.get(SCENE_SHUTDOWN_EVENT)?.(),
  };
}

function fakeStore<T>(initial: T): SubscribableStore<T> & { emit: (next: T) => void } {
  const subscribers = new Set<(state: T, prev: T) => void>();
  let state = initial;
  return {
    subscribe: (listener) => {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    emit: (next) => {
      const prev = state;
      state = next;
      subscribers.forEach((listener) => listener(next, prev));
    },
  };
}

describe('bindStore', () => {
  it('subscribes to the store and calls listener on change', () => {
    const { scene } = fakeScene();
    const store = fakeStore(0);
    const listener = vi.fn();

    bindStore(scene, store, listener);
    store.emit(1);

    expect(listener).toHaveBeenCalledWith(1, 0);
  });

  it('unsubscribes when the scene shuts down (Phaser.Scenes.Events.SHUTDOWN)', () => {
    const { scene, shutdown } = fakeScene();
    const store = fakeStore(0);
    const listener = vi.fn();

    bindStore(scene, store, listener);
    shutdown();
    store.emit(1);

    expect(listener).not.toHaveBeenCalled();
  });

  it('returns the unsubscribe function for callers that want to tear down earlier', () => {
    const { scene } = fakeScene();
    const store = fakeStore(0);
    const listener = vi.fn();

    const unsubscribe = bindStore(scene, store, listener);
    unsubscribe();
    store.emit(1);

    expect(listener).not.toHaveBeenCalled();
  });

  it('SCENE_SHUTDOWN_EVENT matches the real Phaser 4 constant (regression guard against drift on upgrade)', () => {
    // bindStore.ts can't `import Phaser` (crashes under vitest's node env — no `window`), so its
    // event-name constant is inlined. Guard against Phaser upgrades silently renaming it by
    // reading the installed package's own source, the same file used to confirm this value.
    const source = readFileSync(
      resolve(process.cwd(), 'node_modules/phaser/src/scene/events/SHUTDOWN_EVENT.js'),
      'utf-8',
    );
    expect(source).toContain(`module.exports = '${SCENE_SHUTDOWN_EVENT}'`);
  });
});
