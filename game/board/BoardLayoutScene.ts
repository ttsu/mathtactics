// Static, empty board layout (task 03): placeholder shapes only, no game state.
// Every position comes from ./layout; this file only decides how the placeholders look.

import Phaser from 'phaser';
import type { Rect } from '../state/designSpace';
import {
  BASE_STRIP,
  CELL_INSET,
  CELL_OUTLINE_WIDTH,
  COLUMN_COUNT,
  CORNER_RADIUS,
  LANE_COUNT,
  TEST_LABEL_FONT_SIZE,
  TRAY,
  cellRect,
  designToWorld,
} from './layout';

// Placeholder chrome colours — replaced by the art pass (M5); not gameplay tuning.
const PLACEHOLDER = {
  base: 0x6d4c8f,
  cannonSlot: 0x3b4a5c,
  tileCell: 0xf4efe3,
  cellOutline: 0xc9bfa8,
  tray: 0xd9cfb8,
  label: '#2b2b2b',
} as const;

export class BoardLayoutScene extends Phaser.Scene {
  constructor() {
    super('board-layout');
  }

  create(): void {
    const g = this.add.graphics();

    fillRect(g, inset(BASE_STRIP, CELL_INSET), PLACEHOLDER.base);

    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      for (let col = 0; col < COLUMN_COUNT; col += 1) {
        const cell = inset(cellRect(lane, col), CELL_INSET);
        if (col === 0) {
          fillRect(g, cell, PLACEHOLDER.cannonSlot);
        } else {
          fillRect(g, cell, PLACEHOLDER.tileCell);
          g.lineStyle(designToWorld(CELL_OUTLINE_WIDTH), PLACEHOLDER.cellOutline);
          g.strokeRoundedRect(
            designToWorld(cell.x),
            designToWorld(cell.y),
            designToWorld(cell.width),
            designToWorld(cell.height),
            designToWorld(CORNER_RADIUS),
          );
        }
      }
    }

    fillRect(g, inset(TRAY, CELL_INSET), PLACEHOLDER.tray);

    // Crispness check on device (task 03 req. 4): real −/× glyphs at 48pt design size.
    this.add
      .text(
        designToWorld(TRAY.x + TRAY.width / 2),
        designToWorld(TRAY.y + TRAY.height / 2),
        '+5  ×3  −2  = 13',
        {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: `${designToWorld(TEST_LABEL_FONT_SIZE)}px`,
          fontStyle: 'bold',
          color: PLACEHOLDER.label,
        },
      )
      .setOrigin(0.5);
  }
}

function inset(rect: Rect, by: number): Rect {
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: rect.width - by * 2,
    height: rect.height - by * 2,
  };
}

function fillRect(g: Phaser.GameObjects.Graphics, rect: Rect, color: number): void {
  g.fillStyle(color);
  g.fillRoundedRect(
    designToWorld(rect.x),
    designToWorld(rect.y),
    designToWorld(rect.width),
    designToWorld(rect.height),
    designToWorld(CORNER_RADIUS),
  );
}
