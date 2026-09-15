// Plays one playback segment's beats on the board (task 10 req. 3), and snaps the segment to its
// final state when it ends or is skipped (req. 5).
//
// Everything shown comes from event payloads — values, cells, damage, HP — never recomputed.
// Every duration, scale, distance and shake comes from `presentation.json`. Anything this player
// creates or animates is tracked, so `finish()` can stop it all and leave clean final sprites.

import Phaser from 'phaser';
import type { Cell } from '../../../sim/core/coords';
import type { GameEvent } from '../../../sim/core/types';
import type { GameData } from '../../../sim/data/schemas';
import type { StoreApi } from 'zustand/vanilla';
import type { AppStore } from '../../state/store';
import { DEPTH, type BoardRenderer } from '../BoardRenderer';
import { fillRect, inset } from '../drawBoardBackground';
import {
  BALL_IMPACT_OFFSET,
  BALL_RADIUS,
  BIG_STAR_RADIUS,
  BURST_RING_WIDTH,
  BURST_STAR_RADIUS,
  CELL_INSET,
  COIN_FONT_SIZE,
  DAMAGE_FONT_SIZE,
  PUFF_RING_WIDTH,
  ROBOT_SIZE,
  SPARK_STAR_RADIUS,
  TILE_LABEL_FONT_SIZE,
  baseStripCenter,
  baseStripRect,
  cellCenter,
  designToWorld,
  waitingGhostCenter,
} from '../layout';
import { formatNumber, tileColor, tileLabel } from '../pieces';
import { BallView } from '../views/BallView';
import {
  COIN_TEXT_COLOR,
  DOUBLED_DAMAGE_TEXT_COLOR,
  LIGHT_TEXT_COLOR,
  PLACEHOLDER,
} from '../views/palette';
import type { RobotView } from '../views/RobotView';
import { drawRing, drawStar, floatingText } from './effects';
import { bouncesBack, isHudEvent, lastCellBefore, type PlaybackSegment } from './segments';
import type { TimedBeat } from './timeline';
import { transformEffect, type TransformEffect } from './transformEffect';

type EventOf<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;

export class SegmentPlayer {
  private readonly tweens: Phaser.Tweens.Tween[] = [];
  private readonly transients: Phaser.GameObjects.GameObject[] = [];
  private readonly committed = new Set<number>();
  private ball: BallView | null = null;
  private ballPop: Phaser.Tweens.Tween | null = null;
  private ballWobble: Phaser.Tweens.Tween | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly renderer: BoardRenderer,
    private readonly store: StoreApi<AppStore>,
    private readonly segment: PlaybackSegment,
    private readonly onLaneStarted: (lane: number) => void,
  ) {}

  private get settings(): GameData['presentation']['playback'] {
    return this.store.getState().data.presentation.playback;
  }

  /** Fractions of a beat's duration given to its sub-animations. */
  private get share(): GameData['presentation']['playback']['beatShares'] {
    return this.settings.beatShares;
  }

  play({ event, durationMs }: TimedBeat): void {
    switch (event.type) {
      case 'LaneStarted':
        return this.laneStarted(event, durationMs);
      case 'BallFired':
        return this.ballFired(event, durationMs);
      case 'BallMoved':
        return this.ballMoved(event, durationMs);
      case 'BallTransformed':
        return this.ballTransformed(event, durationMs);
      case 'RobotDamaged':
        return this.robotDamaged(event, durationMs);
      case 'RobotBouncedBack':
        return this.robotBouncedBack(event, durationMs);
      case 'RobotDefeated':
        return event.exact
          ? this.exactKill(event, durationMs)
          : this.robotDefeated(event, durationMs);
      case 'BallBlocked':
        return this.ballBlocked(event, durationMs);
      case 'BallExited':
        return this.ballExited(event, durationMs);
      case 'CoinsChanged':
        return this.coinsChanged(event, durationMs);
      case 'LaneEnded':
        return this.consumeBall(durationMs);
      case 'RobotAdvanced':
        return this.robotAdvanced(event, durationMs);
      case 'RobotDetonated':
        return this.segment.group === 'advance'
          ? this.robotLurches(event, durationMs)
          : this.robotDetonated(event, durationMs);
      case 'BaseDamaged':
        return this.baseDamaged(event, durationMs);
      case 'RobotSpawned':
        return this.robotSpawned(event, durationMs);
      case 'RobotWaiting':
        return this.robotWaiting(event, durationMs);
      default:
        // HUD events without a board beat yet (M2) still commit when they play.
        this.commit(event);
    }
  }

  /** Stops every animation this segment started and applies each event's final state: the ball
   * gone, tiles and cannon at rest, robots at their final HP or removed. With `commit`, HUD
   * events not yet played are committed too (skip / natural end); without it (the sequence was
   * abandoned because the store already moved on) nothing is reported to the store. */
  finish({ commit }: { commit: boolean }): void {
    for (const tween of this.tweens) tween.remove();
    this.tweens.length = 0;
    this.ballPop = null;
    this.ballWobble = null;
    for (const object of this.transients) object.destroy();
    this.transients.length = 0;
    this.ball = null;
    this.scene.cameras.main.resetFX();

    for (const event of this.segment.events) {
      switch (event.type) {
        case 'LaneStarted':
          this.renderer.cannonView(event.lane)?.setScale(1);
          break;
        case 'BallTransformed': {
          const tile = this.renderer.tileView(event.pieceId);
          tile?.setScale(1);
          tile?.flash.setAlpha(0);
          break;
        }
        case 'RobotDamaged':
        case 'RobotBouncedBack':
          this.restRobot(event.robotId, event.at)?.setHp(event.hpAfter);
          break;
        case 'BallBlocked':
          this.restRobot(event.robotId, event.at);
          break;
        case 'RobotDefeated':
          this.restRobot(event.robotId, event.at)?.setVisible(false);
          break;
        case 'RobotAdvanced':
          this.restRobot(event.robotId, event.to);
          break;
        case 'RobotDetonated':
          if (this.segment.group === 'advance') {
            this.restRobotAt(event.robotId, worldBaseCenter(event.lane));
          } else {
            this.restRobotAt(event.robotId, worldBaseCenter(event.lane))?.setVisible(false);
          }
          break;
        case 'BaseDamaged':
          // Always re-commits the exact clamped value, even if `baseDamaged`'s count-down never
          // started (an earlier beat in this segment was skipped first) or was cut off mid-count
          // (its tween was just removed, above) — the HUD must land on the real final number.
          if (commit) {
            this.store.getState().commitEvent({ ...event, hpAfter: Math.max(0, event.hpAfter) });
          }
          break;
        case 'RobotSpawned': {
          const robot = this.renderer.ensureRobotView(event.robotId);
          robot.setHp(event.hp, event.maxHp);
          this.restRobot(event.robotId, event.at);
          break;
        }
        case 'RobotWaiting': {
          const robot = this.renderer.ensureRobotView(event.robotId);
          robot.setHp(event.hp, event.maxHp);
          this.restRobotAt(event.robotId, worldGhostCenter(event.lane))?.setAlpha(
            this.settings.spawn.ghostAlpha,
          );
          break;
        }
        default:
          if (commit) this.commit(event);
      }
    }
  }

  // --- Beats ---

  private laneStarted(event: EventOf<'LaneStarted'>, durationMs: number): void {
    this.onLaneStarted(event.lane);
    const cannon = this.renderer.cannonView(event.lane);
    if (cannon === undefined) return;
    this.tween({
      targets: cannon,
      scale: this.settings.cannon.thumpScale,
      duration: durationMs * this.share.half,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private ballFired(event: EventOf<'BallFired'>, durationMs: number): void {
    const ball = this.track(new BallView(this.scene)).setDepth(DEPTH.ball);
    const { x, y } = worldCenter(event.at);
    ball.setPosition(x, y).setValue(event.value);
    ball.setScale(this.settings.ball.fireFromScale);
    this.ball = ball;
    this.tween({ targets: ball, scale: 1, duration: durationMs, ease: 'Back.easeOut' });
  }

  private ballMoved(event: EventOf<'BallMoved'>, durationMs: number): void {
    if (this.ball === null) return;
    const target = worldCenter(event.to);
    // A ball about to hit a robot stops against its face rather than on top of it.
    const next = this.segment.events.find((e) => e.step > event.step);
    const hitsRobot = next?.type === 'RobotDamaged' || next?.type === 'BallBlocked';
    const x = hitsRobot ? target.x - designToWorld(BALL_IMPACT_OFFSET) : target.x;
    // The ball rolls straight along the lane, through any tiles (the pass effect keeps the tile's
    // operation readable while the ball covers it).
    this.tween({ targets: this.ball, x, y: target.y, duration: durationMs, ease: 'Linear' });
  }

  private ballTransformed(event: EventOf<'BallTransformed'>, durationMs: number): void {
    const { transform } = this.settings;
    const effect = transformEffect(event, transform);
    const tileColorValue = Phaser.Display.Color.ValueToColor(
      tileColor(event.tileId, this.store.getState().data).hex,
    ).color;
    const tile = this.renderer.tileView(event.pieceId);
    if (tile !== undefined) {
      tile.flash.setAlpha(transform.tileFlashAlpha);
      this.tween({ targets: tile.flash, alpha: 0, duration: durationMs, ease: 'Quad.easeIn' });
      this.tween({
        targets: tile,
        scale: transform.tilePopScale,
        duration: durationMs * this.share.half,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
    const center = worldCenter(event.at);
    this.operatorLabel(event, effect, center, transform.effectMs);
    this.passRings(effect, center, tileColorValue, transform.effectMs);
    this.passSparks(effect, center, tileColorValue, transform.effectMs);
    if (effect.shake > 0) this.scene.cameras.main.shake(effect.shakeMs, effect.shake, true);

    const ball = this.ball;
    if (ball === null) return;
    ball.setValue(event.newValue);
    // Escalation (GDD §12.2): each further tile in the chain pops the ball bigger; × pops hardest.
    this.settleBall(ball);
    this.ballPop = this.tween({
      targets: ball,
      scale: effect.ballPopScale,
      duration: durationMs,
      yoyo: true,
      ease: 'Back.easeOut',
    });
    if (effect.wobbleDeg > 0) {
      ball.setAngle(-effect.wobbleDeg);
      this.ballWobble = this.tween({
        targets: ball,
        angle: 0,
        duration: durationMs * 2,
        ease: 'Elastic.easeOut',
      });
    }
  }

  /** A copy of the tile's label (`+2`, `×3`) pops out of the tile and floats above the ball, so
   * the operation stays readable while the ball covers the tile. */
  private operatorLabel(
    event: EventOf<'BallTransformed'>,
    effect: TransformEffect,
    center: { x: number; y: number },
    effectMs: number,
  ): void {
    const label = floatingText(
      this.scene,
      center.x,
      center.y - designToWorld(BALL_RADIUS),
      tileLabel(event.tileId),
      TILE_LABEL_FONT_SIZE,
      LIGHT_TEXT_COLOR,
    );
    this.track(label).setDepth(DEPTH.effects).setScale(this.settings.ball.fireFromScale);
    this.tween({
      targets: label,
      y: center.y - designToWorld(effect.labelFloatPt),
      scale: effect.labelScale,
      duration: effectMs * this.share.grow,
      ease: 'Back.easeOut',
    });
    this.tween({
      targets: label,
      alpha: 0,
      delay: effectMs * this.share.most,
      duration: effectMs * this.share.fade,
    });
  }

  /** Rings in the tile's colour burst out from behind the ball, one after another. */
  private passRings(
    effect: TransformEffect,
    center: { x: number; y: number },
    color: number,
    effectMs: number,
  ): void {
    for (let i = 0; i < effect.ringCount; i += 1) {
      const ring = this.track(
        drawRing(this.scene.add.graphics(), color, BURST_RING_WIDTH, BALL_RADIUS),
      );
      ring.setPosition(center.x, center.y).setDepth(DEPTH.tilePass);
      this.tween({
        targets: ring,
        scale: effect.ringScale,
        alpha: 0,
        delay: effectMs * this.share.quick * i,
        duration: effectMs * this.share.most,
        ease: 'Cubic.easeOut',
      });
    }
  }

  /** Sparks fly out from behind the ball (× tiles). */
  private passSparks(
    effect: TransformEffect,
    center: { x: number; y: number },
    color: number,
    effectMs: number,
  ): void {
    const distance = designToWorld(effect.sparkBurstPt);
    for (let i = 0; i < effect.sparkCount; i += 1) {
      const angle = (i / effect.sparkCount) * Math.PI * 2;
      const spark = this.track(
        drawStar(
          this.scene.add.graphics(),
          designToWorld(SPARK_STAR_RADIUS),
          PLACEHOLDER.tileFlash,
          color,
        ),
      );
      spark.setPosition(center.x, center.y).setDepth(DEPTH.tilePass);
      this.tween({
        targets: spark,
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance,
        angle: this.settings.exactKill.starSpinDeg,
        duration: effectMs * this.share.most,
        ease: 'Cubic.easeOut',
      });
      this.tween({
        targets: spark,
        alpha: 0,
        delay: effectMs * this.share.half,
        duration: effectMs * this.share.fade,
      });
    }
  }

  private robotDamaged(event: EventOf<'RobotDamaged'>, durationMs: number): void {
    const { impact } = this.settings;
    this.consumeBall(durationMs * this.share.quick);
    const robot = this.renderer.robotView(event.robotId);
    const center = worldCenter(event.at);

    const label = floatingText(
      this.scene,
      center.x,
      center.y - designToWorld(ROBOT_SIZE / 2),
      `−${event.damage}`,
      DAMAGE_FONT_SIZE,
      event.doubled ? DOUBLED_DAMAGE_TEXT_COLOR : LIGHT_TEXT_COLOR,
    );
    this.track(label).setDepth(DEPTH.effects);
    if (event.doubled) label.setScale(impact.doubledDamageScale);
    this.tween({
      targets: label,
      y: label.y - designToWorld(impact.damageFloatPt),
      duration: durationMs,
      ease: 'Cubic.easeOut',
    });
    this.tween({
      targets: label,
      alpha: 0,
      delay: durationMs * this.share.most,
      duration: durationMs * this.share.fade,
    });

    if (event.damage > 0) {
      this.scene.cameras.main.shake(
        impact.shakeMs,
        Math.min(impact.shakeMax, impact.shakePerDamage * event.damage),
        true,
      );
    }
    if (robot === undefined) return;

    this.tween({
      targets: robot,
      x: center.x + designToWorld(impact.knockbackPt),
      duration: durationMs * this.share.quick,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    if (bouncesBack(this.segment, event)) {
      // Overshot Bounce-back: the HP text holds `hpBefore` (it only ever shows payload values)
      // while the bar dips toward empty; the bounce beat counts the text to `hpAfter` and springs
      // the bar back up (GDD §6.2).
      robot.showHpText(event.hpBefore);
      this.counter(robot.barFill, 0, durationMs * this.share.most, 'Cubic.easeOut', (value) =>
        robot.setBarFill(value),
      );
      return;
    }
    this.countHp(
      robot,
      event.hpBefore,
      event.hpAfter,
      durationMs * this.share.most,
      'Cubic.easeOut',
    );
  }

  private robotBouncedBack(event: EventOf<'RobotBouncedBack'>, durationMs: number): void {
    const robot = this.renderer.robotView(event.robotId);
    if (robot === undefined) return;
    const { maxBarFill } = this.settings.bounceBack;
    this.counter(
      robot.displayedHp,
      event.hpAfter,
      durationMs * this.share.half,
      'Quad.easeOut',
      (value) => robot.showHpText(Math.round(value)),
    );
    // The bar springs back up past its final fill and wobbles into place.
    this.counter(
      robot.barFill,
      event.hpAfter / robot.maxHp,
      durationMs,
      'Elastic.easeOut',
      (value) => robot.setBarFill(value, maxBarFill),
    );
    robot.setScale(this.settings.bounceBack.wobbleScale);
    this.tween({ targets: robot, scale: 1, duration: durationMs, ease: 'Elastic.easeOut' });
  }

  private robotDefeated(event: EventOf<'RobotDefeated'>, durationMs: number): void {
    const center = worldCenter(event.at);
    const puff = this.track(drawRing(this.scene.add.graphics(), PLACEHOLDER.puff, PUFF_RING_WIDTH));
    puff.setPosition(center.x, center.y).setDepth(DEPTH.effects);
    this.tween({
      targets: puff,
      scale: this.settings.defeat.puffScale,
      alpha: 0,
      duration: durationMs,
      ease: 'Quad.easeOut',
    });
    this.popAway(event.robotId, this.settings.defeat.popScale, durationMs);
  }

  /** Exact kill (GDD §5.5, §12.2): a star burst, a big star and a shock ring — no reading needed,
   * and clearly bigger than a normal kill. */
  private exactKill(event: EventOf<'RobotDefeated'>, durationMs: number): void {
    const { exactKill } = this.settings;
    const center = worldCenter(event.at);
    this.popAway(event.robotId, exactKill.popScale, durationMs * this.share.half);

    const ring = this.track(
      drawRing(this.scene.add.graphics(), PLACEHOLDER.celebration, BURST_RING_WIDTH),
    );
    ring.setPosition(center.x, center.y).setDepth(DEPTH.effects);
    this.tween({
      targets: ring,
      scale: exactKill.ringScale,
      alpha: 0,
      duration: durationMs * this.share.most,
      ease: 'Cubic.easeOut',
    });

    for (let i = 0; i < exactKill.starCount; i += 1) {
      const angle = (i / exactKill.starCount) * Math.PI * 2;
      const star = this.track(
        drawStar(
          this.scene.add.graphics(),
          designToWorld(BURST_STAR_RADIUS),
          PLACEHOLDER.celebration,
          PLACEHOLDER.celebrationOutline,
        ),
      );
      star.setPosition(center.x, center.y).setDepth(DEPTH.effects);
      const distance = designToWorld(exactKill.starBurstPt);
      this.tween({
        targets: star,
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance,
        angle: exactKill.starSpinDeg,
        duration: durationMs * this.share.most,
        ease: 'Cubic.easeOut',
      });
      this.tween({
        targets: star,
        alpha: 0,
        delay: durationMs * this.share.half,
        duration: durationMs * this.share.fade,
      });
    }

    const bigStar = this.track(
      drawStar(
        this.scene.add.graphics(),
        designToWorld(BIG_STAR_RADIUS),
        PLACEHOLDER.celebration,
        PLACEHOLDER.celebrationOutline,
      ),
    );
    bigStar.setPosition(center.x, center.y).setDepth(DEPTH.effects).setScale(0);
    this.tween({
      targets: bigStar,
      scale: exactKill.bigStarScale,
      angle: exactKill.bigStarSpinDeg,
      duration: durationMs * this.share.grow,
      ease: 'Back.easeOut',
    });
    this.tween({
      targets: bigStar,
      alpha: 0,
      delay: durationMs * this.share.most,
      duration: durationMs * this.share.fade,
    });

    this.scene.cameras.main.shake(exactKill.shakeMs, exactKill.shake, true);
  }

  private ballBlocked(event: EventOf<'BallBlocked'>, durationMs: number): void {
    const { blocked } = this.settings;
    const center = worldCenter(event.at);
    const ball = this.ball;
    if (ball !== null) {
      this.tween({
        targets: ball,
        x: ball.x - designToWorld(blocked.bounceOffPt),
        duration: durationMs * this.share.half,
        ease: 'Quad.easeOut',
      });
      this.tween({
        targets: ball,
        alpha: 0,
        delay: durationMs * this.share.half,
        duration: durationMs * this.share.fade,
      });
    }
    const shield = this.track(
      drawRing(this.scene.add.graphics(), PLACEHOLDER.clonk, BURST_RING_WIDTH),
    );
    shield.setPosition(center.x, center.y).setDepth(DEPTH.effects);
    this.tween({ targets: shield, alpha: 0, duration: durationMs, ease: 'Quad.easeIn' });

    const robot = this.renderer.robotView(event.robotId);
    if (robot !== undefined) {
      robot.setX(center.x - designToWorld(blocked.robotWobblePt));
      this.tween({
        targets: robot,
        x: center.x + designToWorld(blocked.robotWobblePt),
        duration: (durationMs * this.share.half) / (2 * (blocked.robotWobbleRepeats + 1)),
        yoyo: true,
        repeat: blocked.robotWobbleRepeats,
        ease: 'Sine.easeInOut',
        onComplete: () => robot.setX(center.x),
      });
    }
    this.scene.cameras.main.shake(blocked.shakeMs, blocked.shake, true);
  }

  private ballExited(_event: EventOf<'BallExited'>, durationMs: number): void {
    const ball = this.ball;
    if (ball === null) return;
    this.settleBall(ball);
    this.tween({
      targets: ball,
      x: ball.x + designToWorld(this.settings.exit.rollPt),
      angle: this.settings.exit.rollSpinDeg,
      alpha: 0,
      duration: durationMs,
      ease: 'Quad.easeIn',
    });
  }

  private coinsChanged(event: EventOf<'CoinsChanged'>, durationMs: number): void {
    this.commit(event);
    const cell = lastCellBefore(this.segment, event.step);
    if (cell === null) return;
    const center = worldCenter(cell);
    const label = floatingText(
      this.scene,
      center.x,
      center.y,
      `+${event.delta}`,
      COIN_FONT_SIZE,
      COIN_TEXT_COLOR,
    );
    this.track(label).setDepth(DEPTH.effects);
    this.tween({
      targets: label,
      y: center.y - designToWorld(this.settings.coins.floatPt),
      duration: durationMs,
      ease: 'Cubic.easeOut',
    });
  }

  /** All `RobotAdvanced` robots move together, one cell left (task 15 req. 2). */
  private robotAdvanced(event: EventOf<'RobotAdvanced'>, durationMs: number): void {
    const robot = this.renderer.robotView(event.robotId);
    if (robot === undefined) return;
    const target = worldCenter(event.to);
    this.tween({
      targets: robot,
      x: target.x,
      y: target.y,
      duration: durationMs,
      ease: 'Quad.easeInOut',
    });
  }

  /** A robot leaving column 1 this advance beat (it detonates later, in its own `detonate:<lane>`
   * segment) lurches into the base strip instead of vanishing, in the same beat as any follower
   * moving into its now-empty cell — so the two never occupy column 1 at once (task 15 req. 2). */
  private robotLurches(event: EventOf<'RobotDetonated'>, durationMs: number): void {
    const robot = this.renderer.robotView(event.robotId);
    if (robot === undefined) return;
    const target = worldBaseCenter(event.lane);
    this.tween({
      targets: robot,
      x: target.x,
      y: target.y,
      duration: durationMs,
      ease: 'Quad.easeIn',
    });
  }

  /** The detonation beat itself (task 15 req. 3, GDD §12.2 step 5): flash and shake at the base
   * strip, the robot's HP flies toward the HUD ♥, then the robot is gone. The base HP count-down
   * is the next beat, `baseDamaged` (this detonation's own `BaseDamaged` event). */
  private robotDetonated(event: EventOf<'RobotDetonated'>, durationMs: number): void {
    const { detonate } = this.settings;
    const center = worldBaseCenter(event.lane);

    const flash = this.track(this.scene.add.graphics()).setDepth(DEPTH.effects);
    fillRect(flash, inset(baseStripRect(event.lane), CELL_INSET), PLACEHOLDER.detonateFlash);
    this.tween({ targets: flash, alpha: 0, duration: durationMs, ease: 'Quad.easeIn' });

    const label = floatingText(
      this.scene,
      center.x,
      center.y,
      formatNumber(event.damage),
      DAMAGE_FONT_SIZE,
      LIGHT_TEXT_COLOR,
    );
    this.track(label).setDepth(DEPTH.effects);
    this.tween({
      targets: label,
      x: designToWorld(detonate.heartTargetX),
      y: designToWorld(detonate.heartTargetY),
      scale: detonate.heartLabelScale,
      duration: durationMs,
      ease: 'Cubic.easeIn',
    });
    this.tween({
      targets: label,
      alpha: 0,
      delay: durationMs * this.share.most,
      duration: durationMs * this.share.fade,
    });

    this.scene.cameras.main.shake(detonate.shakeMs, detonate.shake, true);

    const robot = this.renderer.robotView(event.robotId);
    if (robot !== undefined) {
      this.tween({ targets: robot, scale: 0, alpha: 0, duration: durationMs, ease: 'Back.easeIn' });
    }
  }

  /** The HUD base HP counts down from `hpBefore` to `max(0, hpAfter)` (task 15 req. 3): ticked
   * straight to the store every animation frame. `finish()` always re-commits the exact final
   * clamped value, so a skip mid-count (or before this beat even starts) still lands correctly. */
  private baseDamaged(event: EventOf<'BaseDamaged'>, durationMs: number): void {
    const to = Math.max(0, event.hpAfter);
    this.counter(event.hpBefore, to, durationMs, 'Linear', (value) => {
      this.store.getState().commitEvent({ ...event, hpAfter: Math.round(value) });
    });
  }

  /** A `RobotSpawned` robot drops into column 7 with its HP — or, for a robotId that was already
   * a waiting ghost, slides in from its ghost slot and turns solid (task 15 req. 4). */
  private robotSpawned(event: EventOf<'RobotSpawned'>, durationMs: number): void {
    const { spawn } = this.settings;
    const wasGhost = this.renderer.robotView(event.robotId) !== undefined;
    const robot = this.renderer.ensureRobotView(event.robotId);
    robot.setHp(event.hp, event.maxHp);
    const target = worldCenter(event.at);
    if (wasGhost) {
      this.tween({
        targets: robot,
        x: target.x,
        y: target.y,
        alpha: 1,
        duration: durationMs,
        ease: 'Cubic.easeOut',
      });
      return;
    }
    robot
      .setPosition(target.x, target.y - designToWorld(spawn.dropFromPt))
      .setScale(spawn.dropFromScale)
      .setAlpha(1);
    this.tween({ targets: robot, y: target.y, scale: 1, duration: durationMs, ease: 'Back.easeOut' });
  }

  /** A `RobotWaiting` robot pops in as a translucent ghost, its HP visible, just right of column 7
   * (task 15 req. 4). */
  private robotWaiting(event: EventOf<'RobotWaiting'>, durationMs: number): void {
    const { spawn } = this.settings;
    const robot = this.renderer.ensureRobotView(event.robotId);
    robot.setHp(event.hp, event.maxHp);
    const target = worldGhostCenter(event.lane);
    robot.setPosition(target.x, target.y).setScale(spawn.ghostPopFromScale).setAlpha(0);
    this.tween({
      targets: robot,
      scale: 1,
      alpha: spawn.ghostAlpha,
      duration: durationMs,
      ease: 'Back.easeOut',
    });
  }

  // --- Helpers ---

  /** HUD commits follow playback (GDD §12.2 req. 6) — each HUD event is committed exactly once. */
  private commit(event: GameEvent): void {
    if (!isHudEvent(event) || this.committed.has(event.step)) return;
    this.committed.add(event.step);
    this.store.getState().commitEvent(event);
  }

  /** The ball is used up (impact) or leaves: it shrinks away. */
  private consumeBall(durationMs: number): void {
    const ball = this.ball;
    if (ball === null) return;
    this.ball = null;
    this.settleBall(ball);
    this.tween({ targets: ball, scale: 0, alpha: 0, duration: durationMs, ease: 'Quad.easeIn' });
  }

  /** Stops the ball's tile pop and wobble, leaving it upright at rest scale. */
  private settleBall(ball: BallView): void {
    this.ballPop?.remove();
    this.ballWobble?.remove();
    this.ballPop = null;
    this.ballWobble = null;
    ball.setScale(1).setAngle(0);
  }

  private popAway(robotId: string, popScale: number, durationMs: number): void {
    const robot = this.renderer.robotView(robotId);
    if (robot === undefined) return;
    this.tween({
      targets: robot,
      scale: popScale,
      duration: durationMs * this.share.quick,
      ease: 'Quad.easeOut',
      onComplete: () =>
        this.tween({
          targets: robot,
          scale: 0,
          alpha: 0,
          duration: durationMs * (1 - this.share.quick),
          ease: 'Back.easeIn',
        }),
    });
  }

  private countHp(
    robot: RobotView,
    from: number,
    to: number,
    durationMs: number,
    ease: string,
  ): void {
    this.counter(from, to, durationMs, ease, (value) => {
      robot.showHpText(Math.round(value));
      robot.setBarFill(value / robot.maxHp);
    });
  }

  /** A robot back at rest at a world point — unscaled, opaque, no angle (final state after
   * knockback/pops, or after lurching/spawning somewhere that isn't a grid `Cell`: the base strip
   * or a waiting ghost's slot). */
  private restRobotAt(robotId: string, point: { x: number; y: number }): RobotView | undefined {
    const robot = this.renderer.robotView(robotId);
    if (robot === undefined) return undefined;
    return robot.setPosition(point.x, point.y).setScale(1).setAlpha(1).setAngle(0);
  }

  /** A robot back at its cell centre (final state after knockback/pops). */
  private restRobot(robotId: string, at: Cell): RobotView | undefined {
    return this.restRobotAt(robotId, worldCenter(at));
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
    const tween = this.scene.tweens.add(config);
    this.tweens.push(tween);
    return tween;
  }

  private counter(
    from: number,
    to: number,
    durationMs: number,
    ease: string,
    onValue: (value: number) => void,
  ): void {
    const tween = this.scene.tweens.addCounter({
      from,
      to,
      duration: durationMs,
      ease,
      onUpdate: (t) => onValue(t.getValue() ?? to),
    });
    this.tweens.push(tween);
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.transients.push(object);
    return object;
  }
}

function worldCenter(cell: Cell): { x: number; y: number } {
  const { x, y } = cellCenter(cell.lane, cell.col);
  return { x: designToWorld(x), y: designToWorld(y) };
}

/** Where a detonating robot lurches to and flashes — the base strip has no `col`, so this isn't a
 * grid `Cell` (task 15). */
function worldBaseCenter(lane: number): { x: number; y: number } {
  const { x, y } = baseStripCenter(lane);
  return { x: designToWorld(x), y: designToWorld(y) };
}

/** Where a waiting robot's ghost sits, just right of column 7 (task 15). */
function worldGhostCenter(lane: number): { x: number; y: number } {
  const { x, y } = waitingGhostCenter(lane);
  return { x: designToWorld(x), y: designToWorld(y) };
}
