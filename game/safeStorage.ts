// Edge adapter for `localStorage` access (TR §13: "storage failure never breaks play"). Merely
// *reading* the bare `localStorage` global throws `SecurityError` in Safari with "Block All
// Cookies" and in some sandboxed/third-party-iframe contexts — before any of /game/state's own
// try/catch-guarded helpers (game/state/storage.ts) get a chance to run, so an unguarded read at
// the call site (previously `game/main.tsx`'s `storage: localStorage`) could crash boot into a
// blank screen.
//
// Lives outside `/game/state` on purpose: reaching for `window` here is edge/boot code, the same
// kind `game/main.tsx` already does, and keeping it separate means `/game/state` never needs a
// browser global merely to be imported (it must stay importable/testable under Node, TR §2).

import type { StorageLike } from './state/storage';

/** A `StorageLike` backed by a plain in-memory `Map` — used when the real storage is
 * unreachable. Not persisted across reloads, but keeps play going for the session (better than
 * a crash). */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) ?? null) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/**
 * Returns a working `StorageLike`: the real storage from `getRealStorage()` if reachable, else
 * an in-memory fallback. `getRealStorage` defaults to reading `window.localStorage` and is
 * injectable so this is unit-testable without a real DOM/browser.
 */
export function safeStorage(
  getRealStorage: () => StorageLike = () => window.localStorage,
): StorageLike {
  try {
    const storage = getRealStorage();
    // Touch it once — some environments expose the property fine but throw the first time a
    // method on it is actually called, not merely on the property read.
    storage.getItem('__mt_probe__');
    return storage;
  } catch {
    return createMemoryStorage();
  }
}
