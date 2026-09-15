// A robot (task 09 req. 2): simple silhouette block with HP as the largest text on the board
// (GDD §11.2). Traits get their visuals in M4.

import Phaser from 'phaser';
import { CORNER_RADIUS, ROBOT_HP_FONT_SIZE, ROBOT_SIZE, designToWorld } from '../layout';
import { DARK_STROKE_COLOR, FONT_FAMILY, LIGHT_TEXT_COLOR, PLACEHOLDER } from './palette';

export class RobotView extends Phaser.GameObjects.Container {
  private readonly hp: Phaser.GameObjects.Text;

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
    this.add([body, this.hp]);
    scene.add.existing(this);
  }

  setHp(hp: number): void {
    const text = String(hp);
    if (this.hp.text === text) return;
    this.hp.setText(text);
    // Three-digit HP shrinks to fit the block rather than spilling out of it.
    const maxWidth = designToWorld(ROBOT_SIZE - 6);
    this.hp.setScale(Math.min(1, maxWidth / this.hp.width));
  }
}
