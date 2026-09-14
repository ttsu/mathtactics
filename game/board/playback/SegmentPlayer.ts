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
import {
  BALL_IMPACT_OFFSET,
  BIG_STAR_RADIUS,
  BURST_RING_WIDTH,
  BURST_STAR_RADIUS,
  COIN_FONT_SIZE,
  DAMAGE_FONT_SIZE,
  PUFF_RING_WIDTH,
  ROBOT_SIZE,
  cellCenter,
  designToWorld,
} from '../layout';
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

type EventOf<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;

/** Shares of a beat's duration given to its sub-animations — the shape of a beat, not its
 * length (every length is a `presentation.json` value). */
const SHARE = { quick: 0.25, grow: 0.4, half: 0.5, most: 0.7, fade: 0.3 } as const;

export class SegmentPlayer {
  private readonly tweens: Phaser.Tweens.Tween[] = [];
  private readonly transients: Phaser.GameObjects.GameObject[] = [];
  private readonly committed = new Set<number>();
  private ball: BallView | null = null;
  private ballPop: Phaser.Tweens.Tween | null = null;

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
      default:
        // HUD events without a board beat yet (M2) still commit when they play.
        this.commit(event);
    }
  }

  /** Stops every animation this segment started and applies each event's final state: the ball
   * gone, tiles and cannon at rest, robots at their final HP or removed, HUD events committed. */
  finish(): void {
    for (const tween of this.tweens) tween.remove();
    this.tweens.length = 0;
    this.ballPop = null;
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
        default:
          this.commit(event);
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
      duration: durationMs * SHARE.half,
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
    this.tween({ targets: this.ball, x, y: target.y, duration: durationMs, ease: 'Linear' });
  }

  private ballTransformed(event: EventOf<'BallTransformed'>, durationMs: number): void {
    const { transform } = this.settings;
    const tile = this.renderer.tileView(event.pieceId);
    if (tile !== undefined) {
      tile.flash.setAlpha(transform.tileFlashAlpha);
      this.tween({ targets: tile.flash, alpha: 0, duration: durationMs, ease: 'Quad.easeIn' });
      this.tween({
        targets: tile,
        scale: transform.tilePopScale,
        duration: durationMs * SHARE.half,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
    const ball = this.ball;
    if (ball === null) return;
    ball.setValue(event.newValue);
    // Escalation (GDD §12.2): each further tile in the chain pops the ball bigger.
    const pop = Math.min(
      transform.popScaleMax,
      transform.popScale + transform.popScalePerChain * (event.chainDepth - 1),
    );
    this.ballPop?.remove();
    ball.setScale(1);
    this.ballPop = this.tween({
      targets: ball,
      scale: pop,
      duration: durationMs,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }

  private robotDamaged(event: EventOf<'RobotDamaged'>, durationMs: number): void {
    const { impact } = this.settings;
    this.consumeBall(durationMs * SHARE.quick);
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
      delay: durationMs * SHARE.most,
      duration: durationMs * SHARE.fade,
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
      duration: durationMs * SHARE.quick,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    // An overshot Bounce-back robot drains to empty here; its bounce beat refills it.
    const shownAfter = bouncesBack(this.segment, event) ? 0 : event.hpAfter;
    this.countHp(robot, event.hpBefore, shownAfter, durationMs * SHARE.most, 'Cubic.easeOut');
  }

  private robotBouncedBack(event: EventOf<'RobotBouncedBack'>, durationMs: number): void {
    const robot = this.renderer.robotView(event.robotId);
    if (robot === undefined) return;
    const from = robot.displayedHp;
    this.counter(from, event.hpAfter, durationMs * SHARE.half, 'Quad.easeOut', (value) =>
      robot.showHpText(Math.round(value)),
    );
    // The bar springs back up past its final fill and wobbles into place.
    this.counter(
      from / robot.maxHp,
      event.hpAfter / robot.maxHp,
      durationMs,
      'Elastic.easeOut',
      (value) => robot.setBarFill(value),
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
    this.popAway(event.robotId, exactKill.popScale, durationMs * SHARE.half);

    const ring = this.track(
      drawRing(this.scene.add.graphics(), PLACEHOLDER.celebration, BURST_RING_WIDTH),
    );
    ring.setPosition(center.x, center.y).setDepth(DEPTH.effects);
    this.tween({
      targets: ring,
      scale: exactKill.ringScale,
      alpha: 0,
      duration: durationMs * SHARE.most,
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
        angle: 180,
        duration: durationMs * SHARE.most,
        ease: 'Cubic.easeOut',
      });
      this.tween({
        targets: star,
        alpha: 0,
        delay: durationMs * SHARE.half,
        duration: durationMs * SHARE.fade,
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
      angle: 360,
      duration: durationMs * SHARE.grow,
      ease: 'Back.easeOut',
    });
    this.tween({
      targets: bigStar,
      alpha: 0,
      delay: durationMs * SHARE.most,
      duration: durationMs * SHARE.fade,
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
        duration: durationMs * SHARE.half,
        ease: 'Quad.easeOut',
      });
      this.tween({
        targets: ball,
        alpha: 0,
        delay: durationMs * SHARE.half,
        duration: durationMs * SHARE.fade,
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
        duration: (durationMs * SHARE.half) / (2 * (blocked.robotWobbleRepeats + 1)),
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
    this.tween({
      targets: ball,
      x: ball.x + designToWorld(this.settings.exit.rollPt),
      angle: 360,
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
    this.ballPop?.remove();
    this.tween({ targets: ball, scale: 0, alpha: 0, duration: durationMs, ease: 'Quad.easeIn' });
  }

  private popAway(robotId: string, popScale: number, durationMs: number): void {
    const robot = this.renderer.robotView(robotId);
    if (robot === undefined) return;
    this.tween({
      targets: robot,
      scale: popScale,
      duration: durationMs * SHARE.quick,
      ease: 'Quad.easeOut',
      onComplete: () =>
        this.tween({
          targets: robot,
          scale: 0,
          alpha: 0,
          duration: durationMs * (1 - SHARE.quick),
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

  /** A robot back at its cell centre, unscaled and opaque (final state after knockback/pops). */
  private restRobot(robotId: string, at: Cell): RobotView | undefined {
    const robot = this.renderer.robotView(robotId);
    if (robot === undefined) return undefined;
    const { x, y } = worldCenter(at);
    return robot.setPosition(x, y).setScale(1).setAlpha(1).setAngle(0);
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
