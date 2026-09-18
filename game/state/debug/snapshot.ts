// Debug snapshot: a JSON blob the parent copies to an agent. Framework-free. Accepts either
// the wrapped snapshot or a raw `RunState`, so an agent can round-trip either form.

import type { RunState } from '../../../sim/core/types';
import type { Display, LastTurn, Screen } from '../store';
import type { Settings } from '../storage';

export const DEBUG_SNAPSHOT_KIND = 'mathtactics.debugSnapshot';
export const DEBUG_SNAPSHOT_VERSION = 1;

export interface DebugSnapshot {
  kind: typeof DEBUG_SNAPSHOT_KIND;
  version: typeof DEBUG_SNAPSHOT_VERSION;
  exportedAt: number;
  summary: string;
  screen: Screen;
  display: Display;
  settings: Settings;
  run: RunState | null;
  lastTurn: LastTurn | null;
  playbackStatus: 'idle' | 'playing' | 'replaying';
}

export interface SnapshotSource {
  screen: Screen;
  display: Display;
  settings: Settings;
  run: RunState | null;
  lastTurn: LastTurn | null;
  playbackStatus: 'idle' | 'playing' | 'replaying';
}

export function summarizeRun(run: RunState | null): string {
  if (run === null) return 'no run';
  const tiles = Object.keys(run.pieces).length;
  const robots = run.board.robots.length;
  if (run.mode === 'level') {
    return `level ${run.levelId ?? '?'} ${run.phase}, ${tiles} tiles, ${robots} robots`;
  }
  return (
    `run wave ${run.waveIndex + 1} turn ${run.turn} ${run.phase}, ` +
    `♥ ${run.baseHp} 🪙 ${run.coins}, ${tiles} tiles, ${robots} robots`
  );
}

export function buildDebugSnapshot(source: SnapshotSource, exportedAt: number): DebugSnapshot {
  return {
    kind: DEBUG_SNAPSHOT_KIND,
    version: DEBUG_SNAPSHOT_VERSION,
    exportedAt,
    summary: summarizeRun(source.run),
    screen: source.screen,
    display: source.display,
    settings: source.settings,
    run: source.run,
    lastTurn: source.lastTurn,
    playbackStatus: source.playbackStatus,
  };
}

export function stringifyDebugSnapshot(snapshot: DebugSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export type ParseSnapshotResult = { ok: true; run: RunState } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function looksLikeRunState(value: unknown): value is RunState {
  if (!isRecord(value)) return false;
  if (value.mode !== 'run' && value.mode !== 'level') return false;
  if (typeof value.phase !== 'string') return false;
  if (typeof value.schemaVersion !== 'number') return false;
  if (!isRecord(value.board)) return false;
  if (!Array.isArray(value.board.cannons) || !Array.isArray(value.board.robots)) return false;
  if (!Array.isArray(value.tray) || !isRecord(value.pieces)) return false;
  return true;
}

/** Parses a copied snapshot or a raw RunState JSON object. */
export function parseDebugSnapshot(text: string): ParseSnapshotResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not JSON' };
  }
  if (looksLikeRunState(parsed)) {
    return { ok: true, run: parsed };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: 'not a snapshot' };
  }
  if (parsed.kind !== DEBUG_SNAPSHOT_KIND) {
    return { ok: false, error: 'unknown snapshot kind' };
  }
  if (!looksLikeRunState(parsed.run)) {
    return { ok: false, error: 'snapshot has no run' };
  }
  return { ok: true, run: parsed.run };
}
