// Static board chrome (task 03, reused by task 09's BoardScene): base strip, cannon slots, tile
// cells and tray strip. Every position comes from ./layout; this file only decides how they look.

import Phaser from 'phaser';
import type { Rect } from '../state/designSpace';
import {
  BASE_STRIP,
  CELL_INSET,
  CELL_OUTLINE_WIDTH,
  COLUMN_COUNT,
  CORNER_RADIUS,
  LANE_COUNT,
  TRAY,
  cellRect,
  designToWorld,
} from './layout';
import { PLACEHOLDER } from './views/palette';

export function drawBoardBackground(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();

  fillRect(g, inset(BASE_STRIP, CELL_INSET), PLACEHOLDER.base);

  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    for (let col = 0; col < COLUMN_COUNT; col += 1) {
      const cell = inset(cellRect(lane, col), CELL_INSET);
      if (col === 0) {
        fillRect(g, cell, PLACEHOLDER.cannonSlot);
      } else {
        fillRect(g, cell, PLACEHOLDER.tileCell);
        g.lineStyle(designToWorld(CELL_OUTLINE_WIDTH), PLACEHOLDER.cellOutline);
        strokeRect(g, cell);
      }
    }
  }

  fillRect(g, inset(TRAY, CELL_INSET), PLACEHOLDER.tray);
  return g;
}

export function inset(rect: Rect, by: number): Rect {
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: rect.width - by * 2,
    height: rect.height - by * 2,
  };
}

export function fillRect(
  g: Phaser.GameObjects.Graphics,
  rect: Rect,
  color: number,
  alpha = 1,
): void {
  g.fillStyle(color, alpha);
  g.fillRoundedRect(
    designToWorld(rect.x),
    designToWorld(rect.y),
    designToWorld(rect.width),
    designToWorld(rect.height),
    designToWorld(CORNER_RADIUS),
  );
}

export function strokeRect(g: Phaser.GameObjects.Graphics, rect: Rect): void {
  g.strokeRoundedRect(
    designToWorld(rect.x),
    designToWorld(rect.y),
    designToWorld(rect.width),
    designToWorld(rect.height),
    designToWorld(CORNER_RADIUS),
  );
}
