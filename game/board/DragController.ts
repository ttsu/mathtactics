// Touch-friendly drag-and-drop for tiles and cannons (task 09 req. 3). Scene-level pointer
// handling: a press picks up whatever `pickUpAt` finds, the piece lifts and follows the finger
// (drawn a little above it), and releasing dispatches at most one planning command, resolved at
// the finger point.
//
// No optimistic state: on release the piece is handed back to the renderer, which settles it
// home from the last synced state; a successful command then re-syncs it to its new home.
// Only one pointer is tracked — any other pointer is ignored until the drag ends (multi-touch).

import type Phaser from 'phaser';
import type { StoreApi } from 'zustand/vanilla';
import { isPlaybackActive, type AppStore } from '../state/store';
import type { BoardRenderer } from './BoardRenderer';
import {
  heldPieceCenter,
  pickUpAt,
  resolveDrop,
  type DragSource,
  type DropResolution,
} from './dragTargets';
import { TRAY, rectContains, worldToDesign, type Point } from './layout';
import { classifyTrayGesture, scrollAfterDrag, trayOverflows } from './trayScroll';

type Gesture =
  | { mode: 'piece' | 'pending'; pointerId: number; start: Point; source: DragSource }
  | { mode: 'scroll'; pointerId: number; start: Point; startScroll: number };

export class DragController {
  private gesture: Gesture | null = null;

  constructor(
    private readonly store: StoreApi<AppStore>,
    private readonly renderer: BoardRenderer,
  ) {}

  /** Wires scene-level pointer events. Phaser's own input plugin removes them on shutdown. */
  attach(scene: Phaser.Scene): void {
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onDown(pointer));
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onMove(pointer));
    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onUp(pointer));
    scene.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.onUp(pointer));
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
    if (this.gesture !== null) return;
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
      this.renderer.setTrayScroll(scrollAfterDrag(gesture.startScroll, dx, run.tray.length));
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
        this.gesture = {
          mode: 'scroll',
          pointerId: gesture.pointerId,
          start: gesture.start,
          startScroll: this.renderer.trayScroll,
        };
        this.renderer.setTrayScroll(scrollAfterDrag(this.renderer.trayScroll, dx, run.tray.length));
        return;
      }
      if (decided === 'drag') gesture.mode = 'piece';
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

    const { run, dispatch } = this.store.getState();
    const resolution = run ? this.resolve(designPoint(pointer), gesture.source) : null;
    // Hand the piece back first so the command's store update re-syncs it to its new home.
    this.renderer.release();
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
}

function designPoint(pointer: Phaser.Input.Pointer): Point {
  return { x: worldToDesign(pointer.worldX), y: worldToDesign(pointer.worldY) };
}
