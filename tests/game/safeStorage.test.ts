import { describe, expect, it } from 'vitest';
import { createMemoryStorage, safeStorage } from '../../game/safeStorage';
import type { StorageLike } from '../../game/state/storage';

describe('createMemoryStorage', () => {
  it('round-trips values', () => {
    const storage = createMemoryStorage();
    storage.setItem('k', 'v');
    expect(storage.getItem('k')).toBe('v');
  });

  it('returns null for a missing key', () => {
    const storage = createMemoryStorage();
    expect(storage.getItem('missing')).toBeNull();
  });

  it('removeItem deletes a key', () => {
    const storage = createMemoryStorage();
    storage.setItem('k', 'v');
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });

  it('is a fresh, independent store each call', () => {
    const a = createMemoryStorage();
    const b = createMemoryStorage();
    a.setItem('k', 'v');
    expect(b.getItem('k')).toBeNull();
  });
});

describe('safeStorage', () => {
  it('returns the real storage when it works', () => {
    const map = new Map<string, string>();
    const real: StorageLike = {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => {
        map.set(key, value);
      },
      removeItem: (key) => {
        map.delete(key);
      },
    };
    expect(safeStorage(() => real)).toBe(real);
  });

  it('falls back to an in-memory store when the storage getter throws (e.g. Safari "Block All Cookies")', () => {
    const storage = safeStorage(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    // Fallback is a working StorageLike, not merely non-throwing.
    storage.setItem('a', '1');
    expect(storage.getItem('a')).toBe('1');
  });

  it('falls back to an in-memory store when a method on the real storage throws', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('boom');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    const storage = safeStorage(() => throwing);
    expect(storage).not.toBe(throwing);
    storage.setItem('a', '1');
    expect(storage.getItem('a')).toBe('1');
  });

  it('falls back to an in-memory store with the default getter under a window-less environment', () => {
    // No DOM in this test environment (vitest `environment: 'node'`, TR §14/§2) — `window` is
    // undefined, so the default `() => window.localStorage` getter throws a ReferenceError,
    // exercising exactly the guarded path this function exists for.
    const storage = safeStorage();
    storage.setItem('a', '1');
    expect(storage.getItem('a')).toBe('1');
  });
});
