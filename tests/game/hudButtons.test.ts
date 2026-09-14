import { describe, expect, it } from 'vitest';
import { IDLE_PLAYBACK } from '../../game/state/store';
import { hudButtons } from '../../game/ui/hudButtons';
import type { GameEvent, PlanningSnapshot } from '../../sim/core/types';
import { boardState } from './boardFixtures';

const rows = [
  'C . . . . . . .',
  '. . . . . . . .',
  '. . . . . . . .',
  '. . . . . . . .',
  '. . . . . . . .',
];
const snapshot: PlanningSnapshot = { cells: [], tray: [], cannons: [] };
const events: GameEvent[] = [{ step: 0, group: 'fire:lane:0', type: 'LaneStarted', lane: 0 }];

describe('hudButtons', () => {
  it('disables all with no run', () => {
    expect(hudButtons({ run: null, playback: IDLE_PLAYBACK, lastTurn: null })).toEqual({
      endTurn: false,
      undo: false,
      replay: false,
    });
  });

  it('enables End Turn in planning, and Undo only with undo history', () => {
    const run = boardState(rows);
    expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn: null })).toEqual({
      endTurn: true,
      undo: false,
      replay: false,
    });
    expect(
      hudButtons({ run: { ...run, undo: [snapshot] }, playback: IDLE_PLAYBACK, lastTurn: null }),
    ).toEqual({ endTurn: true, undo: true, replay: false });
  });

  it('enables Replay in planning once a turn has played and its snapshot is held', () => {
    const before = boardState(rows);
    const run = { ...before, lastTurnEvents: events };
    const lastTurn = { before, events };
    expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn }).replay).toBe(true);
    // No snapshot (e.g. after a reload): disabled.
    expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn: null }).replay).toBe(false);
  });

  it('disables all while playback is playing or replaying, or outside planning', () => {
    const before = boardState(rows);
    const run = { ...before, undo: [snapshot], lastTurnEvents: events };
    const lastTurn = { before, events };
    const none = { endTurn: false, undo: false, replay: false };
    for (const status of ['playing', 'replaying'] as const) {
      expect(hudButtons({ run, playback: { status, events, cursor: 0 }, lastTurn })).toEqual(none);
    }
    expect(
      hudButtons({ run: { ...run, phase: 'levelCleared' }, playback: IDLE_PLAYBACK, lastTurn }),
    ).toEqual(none);
  });
});
