// Placeholder effect shapes for playback beats (task 10): stars, rings, floating numbers. Only
// how things look — sizes come from ../layout, colours from ../views/palette, and every duration
// or distance is passed in by the caller from `presentation.json`.

import Phaser from 'phaser';
import { ROBOT_SIZE, designToWorld } from '../layout';
import { DARK_STROKE_COLOR, FONT_FAMILY } from '../views/palette';

const STAR_POINTS = 5;
const STAR_INNER_RATIO = 0.45;

/** A filled five-point star centred on the Graphics origin (world px). */
export function drawStar(
  g: Phaser.GameObjects.Graphics,
  outerRadius: number,
  color: number,
  outlineColor: number,
): Phaser.GameObjects.Graphics {
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < STAR_POINTS * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : outerRadius * STAR_INNER_RATIO;
    const angle = -Math.PI / 2 + (i * Math.PI) / STAR_POINTS;
    points.push(new Phaser.Math.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  g.fillStyle(color);
  g.fillPoints(points, true);
  g.lineStyle(Math.max(2, outerRadius / 8), outlineColor);
  g.strokePoints(points, true);
  return g;
}

/** A ring the size of a robot block, centred on the Graphics origin. */
export function drawRing(
  g: Phaser.GameObjects.Graphics,
  color: number,
  thicknessPt: number,
): Phaser.GameObjects.Graphics {
  g.lineStyle(designToWorld(thicknessPt), color);
  g.strokeCircle(0, 0, designToWorld(ROBOT_SIZE / 2));
  return g;
}

/** Bold outlined text for damage numbers and coin rewards. */
export function floatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  fontSizePt: number,
  color: string,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: `${designToWorld(fontSizePt)}px`,
      fontStyle: 'bold',
      color,
      stroke: DARK_STROKE_COLOR,
      strokeThickness: designToWorld(5),
    })
    .setOrigin(0.5);
}
