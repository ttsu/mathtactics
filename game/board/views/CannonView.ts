// A cannon in its slot (task 09 req. 2): dark block showing the cannon base value as a small number.

import Phaser from 'phaser';
import { CANNON_VALUE_FONT_SIZE, CORNER_RADIUS, PIECE_SIZE, designToWorld } from '../layout';
import { FONT_FAMILY, LIGHT_TEXT_COLOR, PLACEHOLDER } from './palette';

export class CannonView extends Phaser.GameObjects.Container {
  private readonly value: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene);
    const size = designToWorld(PIECE_SIZE);
    const body = scene.add.graphics();
    body.fillStyle(PLACEHOLDER.cannon);
    body.fillRoundedRect(-size / 2, -size / 2, size, size, designToWorld(CORNER_RADIUS));
    // Muzzle pointing right, down the lane.
    const muzzle = designToWorld(18);
    body.fillStyle(PLACEHOLDER.cannonMuzzle);
    body.fillRect(size / 2 - muzzle, -muzzle / 2, muzzle, muzzle);

    this.value = scene.add
      .text(-designToWorld(6), 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${designToWorld(CANNON_VALUE_FONT_SIZE)}px`,
        fontStyle: 'bold',
        color: LIGHT_TEXT_COLOR,
      })
      .setOrigin(0.5);
    this.add([body, this.value]);
    scene.add.existing(this);
  }

  setBaseValue(baseValue: number): void {
    const text = String(baseValue);
    if (this.value.text !== text) this.value.setText(text);
  }
}
