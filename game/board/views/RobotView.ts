// A robot (task 09 req. 2): simple silhouette block with HP as the largest text on the board
// (GDD §11.2), and an HP bar under it (task 10: bounce-back visibly refills it). Trait chrome
// is the planning-phase telegraph (task 23 / GDD v0.7.1); Boss overflow scale hangs off the same
// `setChrome` seam in task 26.
//
// Playback (task 10) drives the HP text and bar separately while a hit animates (`showHpText`,
// `setBarFill`); `setHp` puts both back in step. The parity shield is a child of this Container
// so a blocked ball can shake it without moving the body.

import Phaser from 'phaser';
import type { Trait } from '../../../sim/core/types';
import {
  CORNER_RADIUS,
  HP_BAR_GAP,
  HP_BAR_HEIGHT,
  HP_BAR_WIDTH,
  ROBOT_ANTENNA_SPREAD,
  ROBOT_HP_FONT_SIZE,
  ROBOT_SIZE,
  SHIELD_DOT_RADIUS,
  SHIELD_DOT_SPREAD,
  SHIELD_HEIGHT,
  SHIELD_OFFSET_X,
  SHIELD_WIDTH,
  WEAKNESS_BOLT_SIZE,
  WEAKNESS_MARK_OFFSET_X,
  designToWorld,
} from '../layout';
import { formatNumber } from '../pieces';
import { DARK_STROKE_COLOR, FONT_FAMILY, LIGHT_TEXT_COLOR, PLACEHOLDER } from './palette';
import { traitChrome, type TraitChrome, type TraitColours } from './traitChrome';

/** Appearance handed to `setChrome` from both robot creation sites (task 23 seam for task 26). */
export interface RobotAppearance {
  readonly trait: Trait;
  readonly isBoss: boolean;
}

/** What the test handle reports — a description of the live view, not a re-derivation from `run`. */
export interface RobotChromeSnapshot {
  trait: Trait['type'];
  n: number | null;
  pairCount: number;
  coiled: boolean;
  shieldColor: string | null;
  hpFontSize: number;
}

export class RobotView extends Phaser.GameObjects.Container {
  private readonly silhouette: Phaser.GameObjects.Graphics;
  private readonly hp: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private shield: Phaser.GameObjects.Graphics | null = null;
  private shieldRestX = 0;
  private markBolt: Phaser.GameObjects.Graphics | null = null;
  private chest: Phaser.GameObjects.Text | null = null;
  private max = 1;
  private shownHp = 0;
  private fill = -1;
  private appearanceKey: string | null = null;
  private chrome: TraitChrome;
  private bodyScale = 1;

  constructor(
    scene: Phaser.Scene,
    private readonly colours: TraitColours,
    private readonly bossScale: number,
  ) {
    super(scene);
    this.chrome = traitChrome({ type: 'none' }, colours);
    this.silhouette = scene.add.graphics();
    this.paintBody(this.chrome);

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
    this.add([this.silhouette, this.bar, this.hp]);
    scene.add.existing(this);
  }

  get maxHp(): number {
    return this.max;
  }

  /** The HP number currently on the robot (mid-animation, this may differ from its state). */
  get displayedHp(): number {
    return this.shownHp;
  }

  /** Parity shield child, or null when this robot has no shield. */
  shieldObject(): Phaser.GameObjects.Graphics | null {
    return this.shield;
  }

  /** Resting local-x of the shield (design-converted). */
  shieldHomeX(): number {
    return this.shieldRestX;
  }

  /** Snap the shield back after a clonk wobble (playback `finish`). */
  resetChromeMotion(): void {
    this.shield?.setPosition(this.shieldRestX, 0);
  }

  /** Idempotent chrome entry point. Rebuilds only when `trait` / `isBoss` change. Boss overflow
   * scale is applied by redrawing the silhouette (and any chrome drawn on it) larger, never by
   * scaling this Container — playback and `BoardRenderer.place` reset Container scale to 1.
   * HP text and bar stay inside the original `ROBOT_SIZE` box. */
  setChrome({ trait, isBoss }: RobotAppearance): void {
    const key = appearanceKey(trait, isBoss);
    if (key === this.appearanceKey) return;
    this.appearanceKey = key;
    this.chrome = traitChrome(trait, this.colours);
    this.bodyScale = isBoss ? this.bossScale : 1;
    this.paintBody(this.chrome);
    this.syncShield(this.chrome);
    this.syncMark(this.chrome);
    this.hp.setY(0);
    this.bringToTop(this.hp);
  }

  /** Live chrome as drawn, for the test handle (TR §14). */
  getChrome(): RobotChromeSnapshot {
    return {
      trait: this.chrome.trait,
      n: this.chrome.n,
      pairCount: this.chrome.pairCount,
      coiled: this.chrome.coiled,
      shieldColor: this.chrome.shieldColor,
      hpFontSize: ROBOT_HP_FONT_SIZE,
    };
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

  private paintBody(chrome: TraitChrome): void {
    const size = designToWorld(ROBOT_SIZE) * this.bodyScale;
    const g = this.silhouette;
    g.clear();
    const outline = PLACEHOLDER.robotOutline;
    if (chrome.coiled) {
      drawCoil(g, size, outline);
    } else {
      drawAntennae(g, size, 1, outline);
    }
    const fill = chrome.bodyColor ? hexColor(chrome.bodyColor) : PLACEHOLDER.robot;
    g.fillStyle(fill);
    g.fillRoundedRect(-size / 2, -size / 2, size, size, designToWorld(CORNER_RADIUS));
    g.lineStyle(designToWorld(3), outline);
    g.strokeRoundedRect(-size / 2, -size / 2, size, size, designToWorld(CORNER_RADIUS));
  }

  private syncShield(chrome: TraitChrome): void {
    if (chrome.shieldColor === null) {
      this.shield?.destroy();
      this.shield = null;
      this.shieldRestX = 0;
      return;
    }
    if (this.shield === null) {
      this.shield = this.scene.add.graphics();
      this.add(this.shield);
    }
    const scale = this.bodyScale;
    this.shieldRestX = designToWorld(SHIELD_OFFSET_X) * scale;
    paintCarriedShield(
      this.shield,
      chrome.pairCount,
      hexColor(chrome.shieldColor),
      PLACEHOLDER.robotOutline,
      scale,
    );
    this.shield.setPosition(this.shieldRestX, 0);
  }

  private syncMark(chrome: TraitChrome): void {
    if (chrome.n === null || chrome.chestFontSize === null) {
      this.markBolt?.destroy();
      this.markBolt = null;
      this.chest?.destroy();
      this.chest = null;
      return;
    }
    const x = designToWorld(WEAKNESS_MARK_OFFSET_X);
    const boltColor = hexColor(this.colours.weaknessMarkColor);
    if (this.markBolt === null) {
      this.markBolt = this.scene.add.graphics();
      this.add(this.markBolt);
    }
    paintLightningBolt(this.markBolt, boltColor, PLACEHOLDER.robotOutline);
    this.markBolt.setPosition(x - designToWorld(12), 0);

    const fontSize = `${designToWorld(chrome.chestFontSize)}px`;
    const nX = x + designToWorld(10);
    if (this.chest === null) {
      this.chest = this.scene.add
        .text(nX, 0, formatNumber(chrome.n), {
          fontFamily: FONT_FAMILY,
          fontSize,
          fontStyle: 'bold',
          color: this.colours.weaknessNColor,
          stroke: DARK_STROKE_COLOR,
          strokeThickness: designToWorld(3),
        })
        .setOrigin(0, 0.5);
      this.add(this.chest);
    } else {
      this.chest.setPosition(nX, 0).setFontSize(designToWorld(chrome.chestFontSize));
      this.chest.setColor(this.colours.weaknessNColor);
      const text = formatNumber(chrome.n);
      if (this.chest.text !== text) this.chest.setText(text);
    }
  }
}

function appearanceKey(trait: Trait, isBoss: boolean): string {
  const n = trait.type === 'weakness' ? `:${trait.n}` : '';
  return `${trait.type}${n}:${isBoss ? '1' : '0'}`;
}

function hexColor(hex: string): number {
  return Phaser.Display.Color.ValueToColor(hex).color;
}

function drawAntennae(
  g: Phaser.GameObjects.Graphics,
  size: number,
  pairCount: number,
  outline: number,
): void {
  const spread = pairCount === 2 ? designToWorld(ROBOT_ANTENNA_SPREAD) : 0;
  const xs = pairCount === 2 ? [-spread, spread] : [0];
  for (const x of xs) {
    g.lineStyle(designToWorld(4), outline);
    g.lineBetween(x, -size / 2, x, -size / 2 - designToWorld(8));
    g.fillStyle(outline);
    g.fillCircle(x, -size / 2 - designToWorld(9), designToWorld(4));
  }
}

function drawCoil(g: Phaser.GameObjects.Graphics, size: number, outline: number): void {
  g.lineStyle(designToWorld(3), outline);
  const width = designToWorld(18);
  const height = designToWorld(7);
  for (let i = 0; i < 3; i++) {
    g.strokeEllipse(0, -size / 2 - designToWorld(5 + i * 6), width, height);
  }
}

/** Heater shield drawn at the Graphics origin — placed on the left of the robot body. */
function paintCarriedShield(
  g: Phaser.GameObjects.Graphics,
  dots: number,
  fill: number,
  outline: number,
  scale: number,
): void {
  g.clear();
  const hw = (designToWorld(SHIELD_WIDTH) * scale) / 2;
  const hh = (designToWorld(SHIELD_HEIGHT) * scale) / 2;
  const points = [
    [0, -hh],
    [hw * 0.78, -hh * 0.72],
    [hw, -hh * 0.08],
    [hw * 0.62, hh * 0.42],
    [0, hh],
    [-hw * 0.62, hh * 0.42],
    [-hw, -hh * 0.08],
    [-hw * 0.78, -hh * 0.72],
  ].map(([x, y]) => new Phaser.Math.Vector2(x, y));
  g.fillStyle(fill);
  g.fillPoints(points, true);
  g.lineStyle(designToWorld(3), outline);
  g.strokePoints(points, true);

  const radius = designToWorld(SHIELD_DOT_RADIUS) * scale;
  const ys =
    dots === 2
      ? [-designToWorld(SHIELD_DOT_SPREAD) * scale, designToWorld(SHIELD_DOT_SPREAD) * scale]
      : [0];
  for (const y of ys) {
    g.fillStyle(PLACEHOLDER.ballShine);
    g.fillCircle(0, y, radius);
    g.lineStyle(designToWorld(2), outline);
    g.strokeCircle(0, y, radius);
  }
}

function paintLightningBolt(g: Phaser.GameObjects.Graphics, fill: number, outline: number): void {
  g.clear();
  const s = designToWorld(WEAKNESS_BOLT_SIZE);
  const points = [
    [s * 0.35, -s * 0.5],
    [s * 0.12, 0],
    [s * 0.38, 0],
    [-s * 0.35, s * 0.5],
    [-s * 0.08, s * 0.02],
    [-s * 0.32, s * 0.02],
  ].map(([x, y]) => new Phaser.Math.Vector2(x, y));
  g.fillStyle(fill);
  g.fillPoints(points, true);
  g.lineStyle(designToWorld(2), outline);
  g.strokePoints(points, true);
}
