// Renders the planning board from `RunState` (task 09 req. 1–2): tiles keyed by `pieceId`,
// robots by `robotId`, cannons by lane. `sync()` reconciles existing views against the new state
// — creating, updating, moving (with a short settle tween) or destroying only what changed.
//
// Holds no game state of its own beyond "which view is under the finger" and the tray scroll
// offset: every position is derived from the last synced `RunState`, so the board can never
// show a move the store doesn't have.

import Phaser from 'phaser';
import type { Lane } from '../../sim/core/coords';
import type { RunState } from '../../sim/core/types';
import type { GameData } from '../../sim/data/schemas';
import type { DragSource, DropResolution } from './dragTargets';
import { fillRect, inset, strokeRect } from './drawBoardBackground';
import {
  CELL_INSET,
  PIECE_SIZE,
  TRAY,
  TRAY_PADDING,
  TRAY_TILE_SIZE,
  cellCenter,
  cellRect,
  designToWorld,
  worldToDesign,
  traySlotCenter,
  waitingGhostCenter,
  type Point,
} from './layout';
import { pieceHomes, tileColor, type PieceHome } from './pieces';
import { diffKeys, planCannons } from './reconcile';
import { clampTrayScroll, isTraySlotVisible, maxTrayScroll } from './trayScroll';
import { CannonView } from './views/CannonView';
import { PLACEHOLDER } from './views/palette';
import { RobotView, type RobotAppearance, type RobotChromeSnapshot } from './views/RobotView';
import { TileView } from './views/TileView';

/** Draw order for everything on the board, including the playback Director's layers (task 10). */
export const DEPTH = {
  dropFeedback: 1,
  piece: 2,
  robot: 3,
  trayMarkers: 4,
  laneWash: 5,
  /** Rings and sparks from a ball passing through a tile — behind the ball, so its number stays clear. */
  tilePass: 6,
  ball: 7,
  effects: 8,
  held: 10,
} as const;
const TRAY_SCALE = TRAY_TILE_SIZE / PIECE_SIZE;
const EASE = 'Cubic.easeOut';

type PieceView = TileView | CannonView;

export class BoardRenderer {
  private readonly tiles = new Map<string, TileView>();
  private readonly robots = new Map<string, RobotView>();
  private readonly cannons = new Map<Lane, CannonView>();
  private readonly dropFeedback: Phaser.GameObjects.Graphics;
  private readonly trayMarkers: Phaser.GameObjects.Graphics;
  private run: RunState | null = null;
  private held: PieceView | null = null;
  private scroll = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly data: GameData,
  ) {
    this.dropFeedback = scene.add.graphics().setDepth(DEPTH.dropFeedback);
    this.trayMarkers = scene.add.graphics().setDepth(DEPTH.trayMarkers);
  }

  /** Tray scroll offset, in whole slots. */
  get trayScroll(): number {
    return this.scroll;
  }

  setTrayScroll(scroll: number): void {
    const next = clampTrayScroll(scroll, this.run?.tray.length ?? 0);
    if (next === this.scroll) return;
    this.scroll = next;
    this.sync(this.run);
  }

  /** Reconciles every view against `run` (or clears the board for `null`). */
  sync(run: RunState | null): void {
    this.run = run;
    this.scroll = clampTrayScroll(this.scroll, run?.tray.length ?? 0);
    this.syncTiles(run);
    this.syncRobots(run);
    this.syncCannons(run);
    this.drawTrayMarkers(run);
  }

  /** Views by id, for the playback Director (task 10). */
  tileView(pieceId: string): TileView | undefined {
    return this.tiles.get(pieceId);
  }

  robotView(robotId: string): RobotView | undefined {
    return this.robots.get(robotId);
  }

  /** Creates (if needed) and returns the view for `robotId` — for the playback Director to bring
   * a robot onto the board mid-sequence (task 15: a `RobotSpawned`/`RobotWaiting` beat introduces
   * one that wasn't in the pre-turn snapshot). Pass `appearance` so spawn chrome goes through the
   * same `setChrome` entry point as `syncRobots` (task 23; task 26 adds the Boss branch there).
   * The next `sync()` reconciles it against `run` normally. */
  ensureRobotView(robotId: string, appearance?: RobotAppearance): RobotView {
    let view = this.robots.get(robotId);
    if (view === undefined) {
      view = this.createRobotView();
      this.robots.set(robotId, view);
    }
    if (appearance !== undefined) view.setChrome(appearance);
    return view;
  }

  /** Live trait chrome for `robotId`, or `null` if that view isn't on the board. */
  robotChrome(robotId: string): RobotChromeSnapshot | null {
    return this.robots.get(robotId)?.getChrome() ?? null;
  }

  /** What the board draws right now, for the test handle (TR §14): every robot view with its
   * current centre in design points (mid-tween included), and every tile view's piece id. */
  drawn(): { robots: { robotId: string; x: number; y: number }[]; tiles: string[] } {
    return {
      robots: [...this.robots].map(([robotId, view]) => ({
        robotId,
        x: worldToDesign(view.x),
        y: worldToDesign(view.y),
      })),
      tiles: [...this.tiles.keys()],
    };
  }

  cannonView(lane: Lane): CannonView | undefined {
    return this.cannons.get(lane);
  }

  /** The view a drag source refers to. */
  viewFor(source: DragSource): PieceView | undefined {
    return source.kind === 'cannon'
      ? this.cannons.get(source.lane)
      : this.tiles.get(source.pieceId);
  }

  /** Lifts `view` above everything; it follows `moveHeld` until `release`. */
  hold(view: PieceView, liftScale: number, liftDurationMs: number): void {
    this.held = view;
    this.scene.tweens.killTweensOf(view);
    view.setDepth(DEPTH.held);
    this.scene.tweens.add({
      targets: view,
      scale: liftScale,
      duration: liftDurationMs,
      ease: EASE,
    });
  }

  /** Puts the held piece's centre at design point `center`. */
  moveHeld(center: Point): void {
    this.held?.setPosition(designToWorld(center.x), designToWorld(center.y));
  }

  /** Lets go of the held piece: it settles to its home in the last synced state. A command
   * dispatched afterwards re-syncs and redirects it to its new home. */
  release(): void {
    if (this.held === null) return;
    this.held = null;
    this.showDrop(null);
    this.sync(this.run);
  }

  /** Drop feedback while dragging: the target cell (or tray) lights up; a locked/occupied cell
   * with nothing valid in reach tints red. */
  showDrop(resolution: DropResolution | null): void {
    const g = this.dropFeedback;
    g.clear();
    if (resolution === null) return;
    if (resolution.kind === 'invalid') {
      if (resolution.hovered) {
        const { lane, col } = resolution.hovered;
        fillRect(g, inset(cellRect(lane, col), CELL_INSET), PLACEHOLDER.dropInvalid, 0.45);
      }
      return;
    }
    const { target } = resolution;
    if (target.kind === 'tray') {
      if (resolution.kind === 'command') {
        g.lineStyle(designToWorld(6), PLACEHOLDER.dropValid, 0.9);
        strokeRect(g, inset(TRAY, CELL_INSET));
      }
      return;
    }
    const rect = inset(cellRect(target.cell.lane, target.cell.col), CELL_INSET);
    fillRect(g, rect, PLACEHOLDER.dropValid, 0.55);
    g.lineStyle(designToWorld(4), PLACEHOLDER.dropValid, 1);
    strokeRect(g, rect);
  }

  private syncTiles(run: RunState | null): void {
    const homes = run ? pieceHomes(run) : new Map<string, PieceHome>();
    const diff = diffKeys(this.tiles.keys(), homes.keys());
    for (const pieceId of diff.removed) {
      this.destroy(this.tiles.get(pieceId));
      this.tiles.delete(pieceId);
    }
    for (const [pieceId, home] of homes) {
      const tileId = run!.pieces[pieceId]?.tileId;
      if (tileId === undefined) throw new Error(`board references unknown piece "${pieceId}"`);
      let view = this.tiles.get(pieceId);
      const created = view === undefined;
      if (view === undefined) {
        view = new TileView(this.scene).setDepth(DEPTH.piece);
        this.tiles.set(pieceId, view);
      }
      const { hex, starred } = tileColor(tileId, this.data);
      view.setTile(tileId, hex, starred);
      if (view === this.held) continue;
      if (home.kind === 'cell') {
        this.place(view, cellCenter(home.cell.lane, home.cell.col), 1, !created);
      } else if (isTraySlotVisible(home.index, this.scroll)) {
        this.place(
          view,
          traySlotCenter(home.index, this.scroll),
          TRAY_SCALE,
          !created && view.visible,
        );
      } else {
        this.scene.tweens.killTweensOf(view);
        view.setVisible(false);
      }
    }
  }

  /** Renders every robot — on-board and waiting. A waiting robot (`col: null`) has no cell of its
   * own, so it shows as a translucent ghost just right of column 7 (task 15 req. 4, GDD §12.2
   * step 6) — including on a fresh sync (e.g. after resume), not only mid-playback. */
  private syncRobots(run: RunState | null): void {
    const robots = run?.board.robots ?? [];
    const diff = diffKeys(
      this.robots.keys(),
      robots.map((robot) => robot.robotId),
    );
    for (const robotId of diff.removed) {
      this.destroy(this.robots.get(robotId));
      this.robots.delete(robotId);
    }
    const { ghostAlpha } = this.data.presentation.playback.spawn;
    for (const robot of robots) {
      let view = this.robots.get(robot.robotId);
      const created = view === undefined;
      if (view === undefined) {
        view = this.createRobotView();
        this.robots.set(robot.robotId, view);
      }
      view.setChrome({ trait: robot.trait, isBoss: robot.isBoss });
      view.setHp(robot.hp, robot.maxHp);
      view.setAlpha(robot.col === null ? ghostAlpha : 1);
      const center =
        robot.col === null ? waitingGhostCenter(robot.lane) : cellCenter(robot.lane, robot.col);
      this.place(view, center, 1, !created);
    }
  }

  private syncCannons(run: RunState | null): void {
    const plan = planCannons(this.cannons.keys(), run?.board.cannons ?? []);
    const moved = plan.moved.map(({ from, to }) => ({ view: this.cannons.get(from)!, to }));
    for (const { from } of plan.moved) this.cannons.delete(from);
    for (const { view, to } of moved) this.cannons.set(to, view);
    for (const lane of plan.removed) {
      this.destroy(this.cannons.get(lane));
      this.cannons.delete(lane);
    }
    const created = new Set<Lane>();
    for (const lane of plan.added) {
      this.cannons.set(lane, new CannonView(this.scene).setDepth(DEPTH.piece));
      created.add(lane);
    }
    for (const [lane, view] of this.cannons) {
      view.setBaseValue(run!.cannonBaseValue);
      if (view !== this.held) this.place(view, cellCenter(lane, 0), 1, !created.has(lane));
    }
  }

  private drawTrayMarkers(run: RunState | null): void {
    const g = this.trayMarkers;
    g.clear();
    const max = maxTrayScroll(run?.tray.length ?? 0);
    if (max === 0) return;
    const y = TRAY.y + TRAY.height / 2;
    const half = 14;
    const reach = TRAY_PADDING / 2 - CELL_INSET - 1;
    g.fillStyle(PLACEHOLDER.trayMarker);
    if (this.scroll > 0) {
      const x = TRAY.x + TRAY_PADDING / 2;
      g.fillTriangle(
        designToWorld(x - reach),
        designToWorld(y),
        designToWorld(x + reach),
        designToWorld(y - half),
        designToWorld(x + reach),
        designToWorld(y + half),
      );
    }
    if (this.scroll < max) {
      const x = TRAY.x + TRAY.width - TRAY_PADDING / 2;
      g.fillTriangle(
        designToWorld(x + reach),
        designToWorld(y),
        designToWorld(x - reach),
        designToWorld(y - half),
        designToWorld(x - reach),
        designToWorld(y + half),
      );
    }
  }

  /** Moves a view to its home: a short settle tween when it's already on screen, a jump when
   * it's new (or re-appearing from a scrolled-out tray slot). */
  private place(
    view: Phaser.GameObjects.Container,
    center: Point,
    scale: number,
    animate: boolean,
  ): void {
    const x = designToWorld(center.x);
    const y = designToWorld(center.y);
    const baseDepth = view instanceof RobotView ? DEPTH.robot : DEPTH.piece;
    view.setVisible(true);
    if (view.x === x && view.y === y && view.scale === scale) {
      view.setDepth(baseDepth);
      return;
    }
    this.scene.tweens.killTweensOf(view);
    const duration = this.data.presentation.drag.settleDurationMs;
    if (!animate || duration === 0) {
      view.setPosition(x, y).setScale(scale).setDepth(baseDepth);
      return;
    }
    this.scene.tweens.add({
      targets: view,
      x,
      y,
      scale,
      duration,
      ease: EASE,
      onComplete: () => view.setDepth(baseDepth),
    });
  }

  private createRobotView(): RobotView {
    return new RobotView(this.scene, this.data.presentation.traits).setDepth(DEPTH.robot);
  }

  private destroy(view: Phaser.GameObjects.Container | undefined): void {
    if (view === undefined) return;
    if (view === this.held) this.held = null;
    this.scene.tweens.killTweensOf(view);
    view.destroy();
  }
}
