// A robot (task 09 req. 2): simple silhouette block with HP as the largest text on the board
// (GDD §11.2), and an HP bar under it (task 10: bounce-back visibly refills it). Traits get their
// visuals in M4.
//
// Playback (task 10) drives the HP text and bar separately while a hit animates (`showHpText`,
// `setBarFill`); `setHp` puts both back in step.

import Phaser from 'phaser';
import {
  CORNER_RADIUS,
  HP_BAR_GAP,
  HP_BAR_HEIGHT,
  HP_BAR_WIDTH,
  ROBOT_HP_FONT_SIZE,
  ROBOT_SIZE,
  designToWorld,
} from '../layout';
import { formatNumber } from '../pieces';
import { DARK_STROKE_COLOR, FONT_FAMILY, LIGHT_TEXT_COLOR, PLACEHOLDER } from './palette';

export class RobotView extends Phaser.GameObjects.Container {
  private readonly hp: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private max = 1;
  private shownHp = 0;
  private fill = -1;

  constructor(scene: Phaser.Scene) {
    super(scene);
    const size = designToWorld(ROBOT_SIZE);
    const body = scene.add.graphics();
    // Antenna, then body — a block that reads as "robot" rather than "tile".
    body.lineStyle(designToWorld(4), PLACEHOLDER.robotOutline);
    body.lineBetween(0, -size / 2, 0, -size / 2 - designToWorld(8));
    body.fillStyle(PLACEHOLDER.robotOutline);
    body.fillCircle(0, -size / 2 - designToWorld(9), designToWorld(4));
    body.fillStyle(PLACEHOLDER.robot);
    body.fillRoundedRect(-size / 2, -size / 2, size, size, designToWorld(CORNER_RADIUS));
    body.lineStyle(designToWorld(3), PLACEHOLDER.robotOutline);
    body.strokeRoundedRect(-size / 2, -size / 2, size, size, designToWorld(CORNER_RADIUS));

    this.bar = scene.add.graphics();
    this.hp = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${designToWorld(ROBOT_HP_FONT_SIZE)}px`,
        fontStyle: 'bold',
        color: LIGHT_TEXT_COLOR,
        stroke: DARK_STROKE_COLOR,
        strokeThickness: designToWorld(4),
      })
      .setOrigin(0.5);
    this.add([body, this.bar, this.hp]);
    scene.add.existing(this);
  }

  get maxHp(): number {
    return this.max;
  }

  /** The HP number currently on the robot (mid-animation, this may differ from its state). */
  get displayedHp(): number {
    return this.shownHp;
  }

  /** HP text and bar together, from state or a final event value. */
  setHp(hp: number, maxHp: number = this.max): void {
    this.max = Math.max(1, maxHp);
    this.showHpText(hp);
    this.setBarFill(hp / this.max);
  }

  showHpText(hp: number): void {
    this.shownHp = hp;
    const text = formatNumber(hp);
    if (this.hp.text === text) return;
    this.hp.setText(text);
    // Three-digit HP shrinks to fit the block rather than spilling out of it.
    const maxWidth = designToWorld(ROBOT_SIZE - 6);
    this.hp.setScale(Math.min(1, maxWidth / this.hp.width));
  }

  /** Current bar fill, as a fraction of max HP. */
  get barFill(): number {
    return Math.max(0, this.fill);
  }

  /** Bar fill as a fraction of max HP, clamped to `[0, max]` — a springy refill passes a `max`
   * above 1 so it can briefly overshoot a full bar. */
  setBarFill(fraction: number, max = 1): void {
    const fill = Phaser.Math.Clamp(fraction, 0, max);
    if (fill === this.fill) return;
    this.fill = fill;
    const width = designToWorld(HP_BAR_WIDTH);
    const height = designToWorld(HP_BAR_HEIGHT);
    const x = -width / 2;
    const y = designToWorld(ROBOT_SIZE / 2 + HP_BAR_GAP);
    const g = this.bar;
    g.clear();
    g.fillStyle(PLACEHOLDER.hpBarBack);
    g.fillRect(x, y, width, height);
    g.fillStyle(PLACEHOLDER.hpBarFill);
    g.fillRect(x, y, width * fill, height);
  }
}
