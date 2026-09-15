// Playback Director (TR §11.4, task 10): performs a resolved turn's event list on the board as a
// paced, lane-by-lane sequence, then hands the board back to planning via `finishPlayback()`.
//
// - Segments (one per event `group`) play in order; beat timing comes from ./timeline.
// - A tap on the canvas finishes the current segment instantly; the next tap skips the next one.
// - `skipAll()` (test handle) finishes everything at once.
// - The same sequence serves Replay: BoardScene syncs the board to the pre-turn snapshot first,
//   and the store ignores HUD commits while replaying.
//
// No game rules: every value shown comes from event payloads (see ./SegmentPlayer).

import type Phaser from 'phaser';
import type { StoreApi } from 'zustand/vanilla';
import type { GameEvent } from '../../../sim/core/types';
import type { AppStore } from '../../state/store';
import { DEPTH, type BoardRenderer } from '../BoardRenderer';
import {
  BASE_STRIP,
  CELL_SIZE,
  GRID,
  LANE_COUNT,
  LANE_HIGHLIGHT_WIDTH,
  designToWorld,
} from '../layout';
import { PLACEHOLDER } from '../views/palette';
import { SegmentPlayer } from './SegmentPlayer';
import { planPlayback, type SegmentPlan } from './timeline';

interface ActiveSegment {
  player: SegmentPlayer;
  timers: Phaser.Time.TimerEvent[];
}

export class Director {
  private plans: SegmentPlan[] = [];
  private index = 0;
  private active: ActiveSegment | null = null;
  private readonly laneWash: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly renderer: BoardRenderer,
    private readonly store: StoreApi<AppStore>,
  ) {
    this.laneWash = scene.add.graphics().setDepth(DEPTH.laneWash);
    // A tap is judged on release: the press happened during playback, so DragController ignored
    // it, and a skip that ends playback can never turn this same touch into a drag.
    scene.input.on('pointerup', () => this.skipSegment());
  }

  /** True while a sequence is in progress — its beats' tweens and timers are still pending. */
  get busy(): boolean {
    return this.active !== null;
  }

  /** Starts performing `events`, abandoning any sequence already in progress. */
  play(events: readonly GameEvent[]): void {
    this.stop();
    this.plans = planPlayback(events, this.store.getState().data.presentation);
    this.index = 0;
    this.startSegment();
  }

  /** Finishes the current segment instantly and moves on to the next. */
  skipSegment(): void {
    if (this.active !== null) this.endSegment();
  }

  /** Finishes every remaining segment instantly, then completes playback. */
  skipAll(): void {
    while (this.active !== null) this.endSegment();
  }

  /** Abandons the sequence without completing it (the store already moved on, e.g. a new state
   * was installed): animations stop and sprites settle, but nothing is reported to the store. */
  stop(): void {
    const active = this.active;
    this.active = null;
    this.plans = [];
    if (active !== null) this.teardown(active, { commit: false });
    this.laneWash.clear();
  }

  private startSegment(): void {
    const plan = this.plans[this.index];
    if (plan === undefined) {
      this.complete();
      return;
    }
    const player = new SegmentPlayer(this.scene, this.renderer, this.store, plan.segment, (lane) =>
      this.highlightLane(lane),
    );
    const active: ActiveSegment = { player, timers: [] };
    this.active = active;
    const at = (delayMs: number, callback: () => void) =>
      active.timers.push(this.scene.time.delayedCall(delayMs, callback));
    for (const beat of plan.beats) at(plan.leadInMs + beat.atMs, () => player.play(beat));
    at(plan.leadInMs + plan.totalMs, () => this.endSegment());
  }

  private endSegment(): void {
    const active = this.active;
    if (active === null) return;
    this.active = null;
    this.teardown(active, { commit: true });
    // The lane wash stays up through the lane gap; the next LaneStarted moves it, and it clears
    // when the whole sequence ends.
    this.index += 1;
    this.startSegment();
  }

  private teardown(active: ActiveSegment, options: { commit: boolean }): void {
    // `remove(false)` marks each timer done without firing it; the clock drops it next frame
    // (safe even when called from inside one of these timers' callbacks).
    for (const timer of active.timers) timer.remove(false);
    active.player.finish(options);
  }

  private complete(): void {
    this.plans = [];
    this.laneWash.clear();
    // Hands the board back: BoardScene re-syncs from `run` when playback goes idle.
    this.store.getState().finishPlayback();
  }

  /** Active lane highlighted, every other lane dimmed (GDD §12.2). */
  private highlightLane(lane: number): void {
    const g = this.laneWash;
    const { dimAlpha } = this.store.getState().data.presentation.playback.lane;
    const left = designToWorld(BASE_STRIP.x);
    const width = designToWorld(GRID.x + GRID.width - BASE_STRIP.x);
    const height = designToWorld(CELL_SIZE);
    g.clear();
    for (let other = 0; other < LANE_COUNT; other += 1) {
      if (other === lane) continue;
      g.fillStyle(PLACEHOLDER.laneWash, dimAlpha);
      g.fillRect(left, designToWorld(GRID.y + other * CELL_SIZE), width, height);
    }
    g.lineStyle(designToWorld(LANE_HIGHLIGHT_WIDTH), PLACEHOLDER.laneHighlight);
    g.strokeRect(left, designToWorld(GRID.y + lane * CELL_SIZE), width, height);
  }
}
