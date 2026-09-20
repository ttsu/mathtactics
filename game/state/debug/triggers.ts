// Hidden debug-menu openers (parent / agent tools, not kid-facing). Pure so the tap window,
// long-press hold, and shake threshold can be unit-tested with a fake clock. The React layer
// wires these to pointer / keyboard / DeviceMotion events.
//
// Recommended opener on iPad: 7-tap the main-menu title, or long-press Settings / Back.
// Shake is opt-in (iOS needs a permission prompt, and a 7-year-old shakes the iPad).
// Desktop: Ctrl/Cmd+Shift+D, or `?debug=1`.

export const DEBUG_TRIGGERS = {
  /** Rapid taps on a secret target (title, star, wallet). */
  tapCount: 7,
  tapWindowMs: 3500,
  /** Hold Settings or Back. Short tap still does the normal action. */
  longPressMs: 1200,
  keyboard: { shift: true, key: 'd' },
  queryParam: 'debug',
  hash: 'debug',
  /** Opt-in DeviceMotion. Units are m/s² summed absolute deltas. */
  shakeThreshold: 25,
  shakeCooldownMs: 1200,
} as const;

export interface TapSequenceState {
  times: number[];
}

export interface TapSequenceResult {
  times: number[];
  fired: boolean;
}

/** Records a tap at `now`. Fires once `tapCount` taps land inside `tapWindowMs`. */
export function recordTapSequence(
  previous: readonly number[],
  now: number,
  options: { tapCount: number; tapWindowMs: number } = DEBUG_TRIGGERS,
): TapSequenceResult {
  const times = [...previous.filter((time) => now - time <= options.tapWindowMs), now];
  if (times.length >= options.tapCount) {
    return { times: [], fired: true };
  }
  return { times, fired: false };
}

export function longPressHeld(
  startedAt: number,
  now: number,
  holdMs: number = DEBUG_TRIGGERS.longPressMs,
): boolean {
  return now - startedAt >= holdMs;
}

export interface ShakeSample {
  x: number;
  y: number;
  z: number;
}

export interface ShakeState {
  sample: ShakeSample;
  lastFireAt: number;
}

export interface ShakeResult {
  next: ShakeState;
  fired: boolean;
}

/** Compares consecutive accelerometer samples. First sample never fires (no baseline). */
export function shakeStep(
  previous: ShakeState | null,
  sample: ShakeSample,
  now: number,
  options: { shakeThreshold: number; shakeCooldownMs: number } = DEBUG_TRIGGERS,
): ShakeResult {
  if (previous === null) {
    return { next: { sample, lastFireAt: Number.NEGATIVE_INFINITY }, fired: false };
  }
  const delta =
    Math.abs(sample.x - previous.sample.x) +
    Math.abs(sample.y - previous.sample.y) +
    Math.abs(sample.z - previous.sample.z);
  const cooled = now - previous.lastFireAt >= options.shakeCooldownMs;
  const fired = delta >= options.shakeThreshold && cooled;
  return {
    next: { sample, lastFireAt: fired ? now : previous.lastFireAt },
    fired,
  };
}

export function queryWantsDebug(search: string, hash: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const value = params.get(DEBUG_TRIGGERS.queryParam);
  if (value !== null) {
    return value === '' || value === '1' || value === 'true';
  }
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  return normalized === DEBUG_TRIGGERS.hash;
}

export function isDebugHotkey(event: {
  key: string;
  code?: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  if (!event.shiftKey || !(event.ctrlKey || event.metaKey)) return false;
  if (event.key.toLowerCase() === DEBUG_TRIGGERS.keyboard.key) return true;
  // Ctrl+D is a control character in some WebKits (`key` becomes `\u0004`); `code` stays KeyD.
  return event.code?.toLowerCase() === `key${DEBUG_TRIGGERS.keyboard.key}`;
}
