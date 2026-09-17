// Recovers Phaser's pointer pool and the drag latch when a touch end is lost (iOS Control
// Center, a React overlay, Safari identifier reuse). Phaser-free so the rules can be unit-tested.
//
// Phaser 4 keeps one touch Pointer `active` until it sees a matching touchend/touchcancel. The
// default pool is a single touch slot (`input.activePointers` = 1). If that end never arrives,
// every later `touchstart` is dropped — tiles and cannons stop moving. iOS may also synthesize a
// mouse down after a tap and never send mouseup; `DragController` then ignores every new press.

/** Phaser pointer 0 is the mouse; touch fingers are 1+. */
export const MOUSE_POINTER_ID = 0;

export interface PointerSnapshot {
  id: number;
  identifier: number;
  active: boolean;
  isDown: boolean;
  wasTouch: boolean;
  /** True once this pointer has moved from its down position — a live drag, not a tap. */
  moved: boolean;
}

export type PointerDownDecision = 'start' | 'ignore' | 'restart';

/** Identifiers currently on the surface (`TouchEvent.touches`). */
export function touchIdentifiers(list: ArrayLike<{ identifier: number }>): number[] {
  const ids: number[] = [];
  for (let i = 0; i < list.length; i += 1) {
    ids.push(list[i]!.identifier);
  }
  return ids;
}

/**
 * Touch pointers Phaser still thinks are live at `touchstart`, but which this event proves are
 * not: missing from `touches`, or named in `changedTouches` because Safari reused the identifier
 * for a brand-new finger while the previous Pointer was still `active`.
 */
export function pointersToReleaseOnTouchStart(
  pointers: readonly PointerSnapshot[],
  touches: readonly number[],
  changed: readonly number[],
): number[] {
  const onSurface = new Set(touches);
  const starting = new Set(changed);
  const stale: number[] = [];
  for (const pointer of pointers) {
    if (pointer.id === MOUSE_POINTER_ID || !pointer.active) continue;
    if (!onSurface.has(pointer.identifier) || starting.has(pointer.identifier)) {
      stale.push(pointer.id);
    }
  }
  return stale;
}

/**
 * After Phaser has had a chance to process `touchend`/`touchcancel`: any touch Pointer still
 * `active` whose identifier is gone from the surface was missed and must be released.
 */
export function pointersToReleaseAfterTouchEnd(
  pointers: readonly PointerSnapshot[],
  remainingTouches: readonly number[],
): number[] {
  const onSurface = new Set(remainingTouches);
  return pointers
    .filter(
      (pointer) =>
        pointer.id !== MOUSE_POINTER_ID && pointer.active && !onSurface.has(pointer.identifier),
    )
    .map((pointer) => pointer.id);
}

/**
 * What a new `pointerdown` should do given an existing drag gesture.
 *
 * `ignore` is a live second finger (task 09 multi-touch). `restart` means the tracked pointer is
 * stale — missed up, same slot reused, or a real touch preempting a stationary iOS ghost mouse
 * (a mouse that has already moved is a live drag, so extra fingers stay ignored).
 */
export function decidePointerDown(
  gesture: { pointerId: number } | null,
  incoming: Pick<PointerSnapshot, 'id' | 'wasTouch'>,
  tracked: Pick<PointerSnapshot, 'isDown' | 'wasTouch' | 'moved'> | undefined,
): PointerDownDecision {
  if (gesture === null) return 'start';
  if (incoming.id === gesture.pointerId) return 'restart';
  if (tracked === undefined || !tracked.isDown) return 'restart';
  if (incoming.wasTouch && !tracked.wasTouch && !tracked.moved) return 'restart';
  return 'ignore';
}
