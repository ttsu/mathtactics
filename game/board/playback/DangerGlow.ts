// Planning-phase "danger glow" (task 15 req. 6, GDD §12.2 "Planning-phase cues"): a lane whose
// robot sits on column 1 pulses red at the base strip, and that robot wobbles slightly. Derived
// fresh from `run` on every `sync()` call — never cached, never an event — and off during
// playback and Replay (the caller passes `run: null` then).

import Phaser from 'phaser';
import type { Lane } from '../../../sim/core/coords';
import { robotOccupies } from '../../../sim/core/footprint';
import type { RunState } from '../../../sim/core/types';
import type { GameData } from '../../../sim/data/schemas';
import { fillRect, inset } from '../drawBoardBackground';
import { CELL_INSET, baseStripRect } from '../layout';
import type { RobotView } from '../views/RobotView';
import { DEPTH, type BoardRenderer } from '../BoardRenderer';
import { dangerLanes } from './danger';

type DangerSettings = GameData['presentation']['danger'];

interface Wobble {
  view: RobotView;
  tween: Phaser.Tweens.Tween;
}

export class DangerGlow {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private pulse: Phaser.Tweens.Tween | null = null;
  private readonly wobbles: Wobble[] = [];
  private lanes: Lane[] = [];
  private settings: DangerSettings | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly renderer: BoardRenderer,
  ) {
    this.graphics = scene.add.graphics().setDepth(DEPTH.laneWash);
  }

  /** Recomputes the danger lanes from `run` (or turns everything off for `null` — playback,
   * Replay, or no run) and restarts the pulse/wobble only when they actually changed: the danger
   * lanes can't change during one planning phase (only a resolved turn moves robots), so this
   * just skips redundant tween restarts, not the derivation itself. */
  sync(run: RunState | null, settings: DangerSettings): void {
    this.settings = settings;
    const lanes = run ? dangerLanes(run) : [];
    if (sameLanes(lanes, this.lanes) && (lanes.length === 0) === (this.pulse === null)) return;

    this.stopWobbles();
    this.pulse?.remove();
    this.pulse = null;
    this.lanes = lanes;
    this.graphics.clear();
    if (lanes.length === 0 || run === null) return;

    this.pulse = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: settings.pulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => this.draw(tween.getValue() ?? 0),
    });

    for (const lane of lanes) {
      const robot = run.board.robots.find((r) => robotOccupies(r, { lane, col: 1 }));
      const view = robot ? this.renderer.robotView(robot.robotId) : undefined;
      if (view === undefined) continue;
      view.setAngle(-settings.wobbleDeg);
      const tween = this.scene.tweens.add({
        targets: view,
        angle: settings.wobbleDeg,
        duration: settings.wobbleMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.wobbles.push({ view, tween });
    }
  }

  private draw(t: number): void {
    const settings = this.settings;
    this.graphics.clear();
    if (settings === null) return;
    const alpha = settings.minAlpha + (settings.maxAlpha - settings.minAlpha) * t;
    const color = Phaser.Display.Color.ValueToColor(settings.color).color;
    for (const lane of this.lanes) {
      fillRect(this.graphics, inset(baseStripRect(lane), CELL_INSET), color, alpha);
    }
  }

  private stopWobbles(): void {
    for (const { view, tween } of this.wobbles) {
      tween.remove();
      view.setAngle(0);
    }
    this.wobbles.length = 0;
  }
}

function sameLanes(a: readonly Lane[], b: readonly Lane[]): boolean {
  return a.length === b.length && a.every((lane, i) => lane === b[i]);
}
