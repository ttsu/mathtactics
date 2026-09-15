// The ball during playback (task 10 req. 3): a red rubber ball (GDD §12.1) carrying its current
// value in large outlined text, readable in motion (GDD §5.6). Shows only values it is given from
// event payloads.

import Phaser from 'phaser';
import { BALL_RADIUS, BALL_VALUE_FONT_SIZE, designToWorld } from '../layout';
import { formatNumber } from '../pieces';
import { DARK_STROKE_COLOR, FONT_FAMILY, LIGHT_TEXT_COLOR, PLACEHOLDER } from './palette';

export class BallView extends Phaser.GameObjects.Container {
  private readonly value: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene);
    const radius = designToWorld(BALL_RADIUS);
    const body = scene.add.graphics();
    body.fillStyle(PLACEHOLDER.ball);
    body.fillCircle(0, 0, radius);
    body.lineStyle(designToWorld(3), PLACEHOLDER.ballOutline);
    body.strokeCircle(0, 0, radius);
    // A small highlight so it reads as a round rubber ball rather than a flat disc.
    body.fillStyle(PLACEHOLDER.ballShine, 0.35);
    body.fillCircle(-radius * 0.4, -radius * 0.45, radius * 0.22);

    this.value = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${designToWorld(BALL_VALUE_FONT_SIZE)}px`,
        fontStyle: 'bold',
        color: LIGHT_TEXT_COLOR,
        stroke: DARK_STROKE_COLOR,
        strokeThickness: designToWorld(6),
      })
      .setOrigin(0.5);
    this.add([body, this.value]);
    scene.add.existing(this);
  }

  setValue(value: number): void {
    const text = formatNumber(value);
    if (this.value.text === text) return;
    this.value.setText(text);
    // Long values shrink to stay inside the ball rather than spilling out of it.
    const maxWidth = designToWorld(BALL_RADIUS * 2);
    this.value.setScale(Math.min(1, maxWidth / this.value.width));
  }
}
