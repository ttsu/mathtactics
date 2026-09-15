// One tile piece (task 09 req. 2): rounded square in its category colour with the operator and
// number as the dominant element. Drawn at on-board size; the tray shows it scaled down.

import Phaser from 'phaser';
import type { TileId } from '../../../sim/core/types';
import {
  CORNER_RADIUS,
  PIECE_SIZE,
  TILE_LABEL_FONT_SIZE,
  TILE_STAR_FONT_SIZE,
  designToWorld,
} from '../layout';
import { tileLabel } from '../pieces';
import { FONT_FAMILY, PLACEHOLDER, TILE_TEXT_COLOR } from './palette';

export class TileView extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly star: Phaser.GameObjects.Text;
  private tileId: TileId | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.face = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${designToWorld(TILE_LABEL_FONT_SIZE)}px`,
        fontStyle: 'bold',
        color: TILE_TEXT_COLOR,
      })
      .setOrigin(0.5);
    const corner = designToWorld(PIECE_SIZE / 2 - 4);
    this.star = scene.add
      .text(corner, -corner, '★', {
        fontFamily: FONT_FAMILY,
        fontSize: `${designToWorld(TILE_STAR_FONT_SIZE)}px`,
        color: TILE_TEXT_COLOR,
      })
      .setOrigin(1, 0);
    this.add([this.face, this.label, this.star]);
    scene.add.existing(this);
  }

  /** Redraws only when the tile changes (a reused `pieceId` in a newly installed run). */
  setTile(tileId: TileId, colorHex: string, starred: boolean): void {
    if (this.tileId === tileId) return;
    this.tileId = tileId;
    const size = designToWorld(PIECE_SIZE);
    this.face.clear();
    this.face.fillStyle(Phaser.Display.Color.ValueToColor(colorHex).color);
    this.face.fillRoundedRect(-size / 2, -size / 2, size, size, designToWorld(CORNER_RADIUS));
    this.face.lineStyle(designToWorld(2), PLACEHOLDER.tileOutline, 0.25);
    this.face.strokeRoundedRect(-size / 2, -size / 2, size, size, designToWorld(CORNER_RADIUS));
    this.label.setText(tileLabel(tileId));
    this.star.setVisible(starred);
  }
}
