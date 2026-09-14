// Path-scoped persistence helpers (TR §13, GDD §10.4). Pure and DOM-free at the call boundary:
// every function takes a `StorageLike` implementation and `basePath` as parameters instead of
// touching `localStorage`/`location` directly, so this module is unit-testable in vitest's node
// environment. Only the edge (game/main.tsx or a tiny browser adapter) reads the real
// `localStorage` and computes `basePath` from `location`/`import.meta.env.BASE_URL`.
//
// All access is try/catch-guarded: a storage failure (quota, privacy mode, corrupt JSON) must
// never break play (TR §13) — every helper below fails soft (no-op write, `null`/default read).

import type { RunState, TileId } from '../../sim/core/types';

/** The subset of the DOM `Storage` interface these helpers need. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Settings {
  hints: boolean;
  sound: boolean;
}

/** GDD §11.8: hints off by default; sound on by default (see task 05 Completion Notes). */
export const DEFAULT_SETTINGS: Settings = { hints: false, sound: true };

interface SavedRun {
  schemaVersion: number;
  savedAt: number;
  state: RunState;
}

/**
 * `mt:<basePath>:<key>` (TR §13) — `basePath` is `/` in production and `/pr/pr-12/` in a PR
 * preview, so a preview's saves can never collide with (or overwrite) production's.
 */
export function scopedKey(basePath: string, key: string): string {
  return `mt:${basePath}:${key}`;
}

/** Saved after every successful `dispatch` (TR §13, GDD §10.4), including `endTurn` — `state`
 * already includes the resolved turn. `savedAt` is passed in (a real clock at the edge, a fixed
 * value in tests) rather than read from `Date.now()` here, so callers stay deterministic. */
export function saveRun(
  storage: StorageLike,
  basePath: string,
  state: RunState,
  savedAt: number,
): void {
  try {
    const payload: SavedRun = { schemaVersion: state.schemaVersion, savedAt, state };
    storage.setItem(scopedKey(basePath, 'run'), JSON.stringify(payload));
  } catch {
    // Storage failure must never break play (TR §13).
  }
}

/** Loads the saved run, or `null` if there is none, it's corrupt, or its `schemaVersion` does
 * not match `expectedSchemaVersion` — a mismatched save is discarded silently, no migration
 * (TR §13, GDD §10.4). */
export function loadRun(
  storage: StorageLike,
  basePath: string,
  expectedSchemaVersion: number,
): RunState | null {
  try {
    const raw = storage.getItem(scopedKey(basePath, 'run'));
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<SavedRun> | null;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.schemaVersion !== expectedSchemaVersion ||
      !parsed.state
    ) {
      return null;
    }
    return parsed.state;
  } catch {
    return null;
  }
}

function dedupeSorted(ids: readonly TileId[]): TileId[] {
  return Array.from(new Set(ids)).sort();
}

/** Sorted, de-duplicated list of tile ids the player has ever seen (GDD §8.7). Additive and
 * unaffected by `schemaVersion` — it survives version bumps (TR §13). */
export function loadSeen(storage: StorageLike, basePath: string): TileId[] {
  try {
    const raw = storage.getItem(scopedKey(basePath, 'seen'));
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupeSorted(parsed.filter((entry): entry is TileId => typeof entry === 'string'));
  } catch {
    return [];
  }
}

/** Adds `tileId` to the seen-tiles log and returns the new (sorted, de-duplicated) list. */
export function addSeen(storage: StorageLike, basePath: string, tileId: TileId): TileId[] {
  const next = dedupeSorted([...loadSeen(storage, basePath), tileId]);
  try {
    storage.setItem(scopedKey(basePath, 'seen'), JSON.stringify(next));
  } catch {
    // Storage failure must never break play (TR §13).
  }
  return next;
}

/** Loads settings, falling back to `DEFAULT_SETTINGS` for a missing store, a corrupt value, or
 * an individual field of the wrong type. */
export function loadSettings(storage: StorageLike, basePath: string): Settings {
  try {
    const raw = storage.getItem(scopedKey(basePath, 'settings'));
    if (raw === null) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    const candidate = parsed as Partial<Settings>;
    return {
      hints: typeof candidate.hints === 'boolean' ? candidate.hints : DEFAULT_SETTINGS.hints,
      sound: typeof candidate.sound === 'boolean' ? candidate.sound : DEFAULT_SETTINGS.sound,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: StorageLike, basePath: string, settings: Settings): void {
  try {
    storage.setItem(scopedKey(basePath, 'settings'), JSON.stringify(settings));
  } catch {
    // Storage failure must never break play (TR §13).
  }
}
