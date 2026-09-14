// A cannon in its slot (task 09 req. 2): solid dark block with a barrel, showing the cannon base
// value as a small number.

import Phaser from 'phaser';
import { CANNON_VALUE_FONT_SIZE, CORNER_RADIUS, PIECE_SIZE, designToWorld } from '../layout';
import { FONT_FAMILY, LIGHT_TEXT_COLOR, PLACEHOLDER } from './palette';

export class CannonView extends Phaser.GameObjects.Container {
  private readonly value: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene);
    const size = designToWorld(PIECE_SIZE);
    const body = scene.add.graphics();
    // Solid dark body with a barrel pointing right, down the lane — clearly a cannon, and clearly
    // different from the pale empty slot it sits in.
    const barrelLength = designToWorld(30);
    const barrelHeight = designToWorld(30);
    const bodyWidth = size - designToWorld(14);
    body.fillStyle(PLACEHOLDER.cannon);
    body.fillRoundedRect(-size / 2, -size / 2, bodyWidth, size, designToWorld(CORNER_RADIUS));
    body.fillRect(size / 2 - barrelLength, -barrelHeight / 2, barrelLength, barrelHeight);
    body.fillStyle(PLACEHOLDER.cannonBand);
    body.fillRect(size / 2 - designToWorld(8), -barrelHeight / 2, designToWorld(4), barrelHeight);

    this.value = scene.add
      .text(-designToWorld(12), 0, '', {
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
