// Touch-friendly drag-and-drop for tiles and cannons (task 09 req. 3). Scene-level pointer
// handling: a press picks up whatever `pickUpAt` finds, the piece lifts and follows the finger
// (drawn a little above it), and releasing dispatches at most one planning command, resolved at
// the finger point.
//
// No optimistic state: on release the piece is handed back to the renderer, which settles it
// home from the last synced state; a successful command then re-syncs it to its new home.
// Only one pointer is tracked — any other pointer is ignored until the drag ends (multi-touch).
//
// Phaser 4's default touch pool is a single Pointer. If a touchend/touchcancel is lost (iOS
// Control Center, a React overlay stealing the event, Safari identifier reuse), that Pointer
// stays `active` and every later touchstart is dropped — tiles and cannons freeze. iOS may also
// fire a ghost mousedown after a tap and never mouseup, latching `gesture`. Native touch
// listeners keep the pool in sync with the real surface; `decidePointerDown` recovers the latch.

import type Phaser from 'phaser';
import type { StoreApi } from 'zustand/vanilla';
import { isPlaybackActive, type AppStore } from '../state/store';
import { playCue } from '../state/audio';
import { cueForDrop, cueForPickup, traySlotChanged } from '../state/cues';
import type { BoardRenderer } from './BoardRenderer';
import {
  heldPieceCenter,
  pickUpAt,
  resolveDrop,
  type DragSource,
  type DropResolution,
} from './dragTargets';
import { TRAY, rectContains, worldToDesign, type Point } from './layout';
import {
  decidePointerDown,
  pointersToReleaseAfterTouchEnd,
  pointersToReleaseOnTouchStart,
  touchIdentifiers,
  type PointerSnapshot,
} from './pointerSync';
import { classifyTrayGesture, scrollAfterDrag, trayOverflows } from './trayScroll';

type Gesture =
  | { mode: 'piece' | 'pending'; pointerId: number; start: Point; source: DragSource }
  | { mode: 'scroll'; pointerId: number; start: Point; startScroll: number };

/** Same strings as `Phaser.Core.Events.HIDDEN` / `BLUR` — value-importing Phaser crashes vitest. */
const GAME_HIDDEN = 'hidden';
const GAME_BLUR = 'blur';
const SCENE_SHUTDOWN = 'shutdown';

export class DragController {
  private gesture: Gesture | null = null;
  private scene: Phaser.Scene | null = null;

  constructor(
    private readonly store: StoreApi<AppStore>,
    private readonly renderer: BoardRenderer,
  ) {}

  /** Wires scene-level pointer events. Phaser's own input plugin removes them on shutdown. */
  attach(scene: Phaser.Scene): void {
    this.scene = scene;
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onDown(pointer));
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onMove(pointer));
    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onUp(pointer));
    scene.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.onUp(pointer));

    const onTouchStart = (event: TouchEvent) => this.syncTouchStart(event);
    const onTouchEnd = (event: TouchEvent) => this.syncTouchEnd(event);
    const onLost = () => this.releaseLostPointers();
    // Capture start runs before Phaser assigns the touch, so a stale slot can be freed first.
    // Bubble end runs after Phaser's canvas handler, so a missed up is cleaned up rather than
    // racing the real pointerup.
    const touchOpts: AddEventListenerOptions = { capture: true };
    window.addEventListener('touchstart', onTouchStart, touchOpts);
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    scene.game.events.on(GAME_HIDDEN, onLost);
    scene.game.events.on(GAME_BLUR, onLost);

    scene.events.once(SCENE_SHUTDOWN, () => {
      window.removeEventListener('touchstart', onTouchStart, touchOpts);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      scene.game.events.off(GAME_HIDDEN, onLost);
      scene.game.events.off(GAME_BLUR, onLost);
      this.scene = null;
    });
  }

  /** Abandons any drag in progress (e.g. the store changed under it): the piece settles home. */
  cancel(): void {
    this.gesture = null;
    this.renderer.release();
  }

  private get config() {
    return this.store.getState().data.presentation.drag;
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    const decision = decidePointerDown(this.gesture, pointer, this.trackedPointer());
    if (decision === 'ignore') return;
    if (decision === 'restart') this.cancel();

    const state = this.store.getState();
    const { run } = state;
    if (run === null || run.phase !== 'planning' || isPlaybackActive(state)) return;

    const point = designPoint(pointer);
    const source = pickUpAt(point, run, this.renderer.trayScroll);
    const overflowing = trayOverflows(run.tray.length);

    if (source === null) {
      if (overflowing && rectContains(TRAY, point)) {
        this.gesture = {
          mode: 'scroll',
          pointerId: pointer.id,
          start: point,
          startScroll: this.renderer.trayScroll,
        };
      }
      return;
    }

    const view = this.renderer.viewFor(source);
    if (view === undefined) return;
    this.gesture = {
      mode: source.kind === 'trayTile' && overflowing ? 'pending' : 'piece',
      pointerId: pointer.id,
      start: point,
      source,
    };
    this.renderer.hold(view, this.config.liftScale, this.config.liftDurationMs);
    if (this.gesture.mode === 'piece') playCue(cueForPickup(source.kind));
    this.follow(point, source);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    const gesture = this.gesture;
    if (gesture === null || pointer.id !== gesture.pointerId) return;
    const { run } = this.store.getState();
    if (run === null) return;
    const point = designPoint(pointer);
    const dx = point.x - gesture.start.x;

    if (gesture.mode === 'scroll') {
      const previous = this.renderer.trayScroll;
      const next = scrollAfterDrag(gesture.startScroll, dx, run.tray.length);
      this.renderer.setTrayScroll(next);
      if (traySlotChanged(previous, next)) playCue('trayTick');
      return;
    }

    if (gesture.mode === 'pending') {
      const decided = classifyTrayGesture(
        dx,
        point.y - gesture.start.y,
        this.config.trayScrollThresholdPt,
        true,
      );
      if (decided === 'scroll') {
        this.renderer.release();
        const startScroll = this.renderer.trayScroll;
        this.gesture = {
          mode: 'scroll',
          pointerId: gesture.pointerId,
          start: gesture.start,
          startScroll,
        };
        const next = scrollAfterDrag(startScroll, dx, run.tray.length);
        this.renderer.setTrayScroll(next);
        if (traySlotChanged(startScroll, next)) playCue('trayTick');
        return;
      }
      if (decided === 'drag') {
        gesture.mode = 'piece';
        playCue(cueForPickup(gesture.source.kind));
      }
    }

    this.follow(point, gesture.source);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    const gesture = this.gesture;
    if (gesture === null || pointer.id !== gesture.pointerId) return;
    // Phaser 4 reports a TOUCH_CANCEL as a pointer up (InputPlugin processUpEvents) and flags
    // the pointer `wasCanceled` — a cancelled touch abandons the drag instead of dropping.
    if (pointer.wasCanceled) {
      this.cancel();
      return;
    }
    this.gesture = null;
    if (gesture.mode === 'scroll') return;
    if (gesture.mode === 'pending') {
      this.renderer.release();
      return;
    }

    const { run, dispatch } = this.store.getState();
    const resolution = run ? this.resolve(designPoint(pointer), gesture.source) : null;
    // Hand the piece back first so the command's store update re-syncs it to its new home.
    this.renderer.release();
    if (resolution !== null) playCue(cueForDrop(gesture.source.kind, resolution.kind));
    if (resolution?.kind === 'command') {
      dispatch(resolution.command);
    }
  }

  /** Moves the held piece under the finger and refreshes drop feedback. */
  private follow(finger: Point, source: DragSource): void {
    this.renderer.moveHeld(heldPieceCenter(finger, this.config.fingerOffsetPt));
    this.renderer.showDrop(this.resolve(finger, source));
  }

  /** Drops resolve at the finger; the finger offset only affects where the piece is drawn. */
  private resolve(finger: Point, source: DragSource): DropResolution | null {
    const { run } = this.store.getState();
    if (run === null) return null;
    return resolveDrop(source, finger, run, this.config.snapRadiusCells);
  }

  private syncTouchStart(event: TouchEvent): void {
    this.releasePointers(
      pointersToReleaseOnTouchStart(
        this.pointerSnapshots(),
        touchIdentifiers(event.touches),
        touchIdentifiers(event.changedTouches),
      ),
    );
  }

  private syncTouchEnd(event: TouchEvent): void {
    this.releasePointers(
      pointersToReleaseAfterTouchEnd(this.pointerSnapshots(), touchIdentifiers(event.touches)),
    );
  }

  private releaseLostPointers(): void {
    this.cancel();
    this.scene?.input.resetPointers();
  }

  private releasePointers(ids: readonly number[]): void {
    if (ids.length === 0) return;
    const stale = new Set(ids);
    for (const pointer of this.scene?.input.manager.pointers ?? []) {
      if (stale.has(pointer.id)) pointer.reset();
    }
    if (this.gesture !== null && stale.has(this.gesture.pointerId)) this.cancel();
  }

  private trackedPointer(): PointerSnapshot | undefined {
    const id = this.gesture?.pointerId;
    if (id === undefined) return undefined;
    const pointer = this.scene?.input.manager.pointers[id];
    return pointer === undefined ? undefined : snapshot(pointer);
  }

  private pointerSnapshots(): PointerSnapshot[] {
    return (this.scene?.input.manager.pointers ?? []).map(snapshot);
  }
}

function snapshot(pointer: Phaser.Input.Pointer): PointerSnapshot {
  return {
    id: pointer.id,
    identifier: pointer.identifier,
    active: pointer.active,
    isDown: pointer.isDown,
    wasTouch: pointer.wasTouch,
    moved: pointer.x !== pointer.downX || pointer.y !== pointer.downY,
  };
}

function designPoint(pointer: Phaser.Input.Pointer): Point {
  return { x: worldToDesign(pointer.worldX), y: worldToDesign(pointer.worldY) };
}
