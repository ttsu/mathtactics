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
  it('disables End Turn/Undo/Replay with no run, but shows Home (idle)', () => {
    expect(hudButtons({ run: null, playback: IDLE_PLAYBACK, lastTurn: null })).toEqual({
      endTurn: false,
      undo: false,
      replay: false,
      home: true,
    });
  });

  it('enables End Turn in planning, and Undo only with undo history', () => {
    const run = boardState(rows);
    expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn: null })).toEqual({
      endTurn: true,
      undo: false,
      replay: false,
      home: true,
    });
    expect(
      hudButtons({ run: { ...run, undo: [snapshot] }, playback: IDLE_PLAYBACK, lastTurn: null }),
    ).toEqual({ endTurn: true, undo: true, replay: false, home: true });
  });

  it('enables Replay in planning once a turn has played and its snapshot is held', () => {
    const before = boardState(rows);
    const run = { ...before, lastTurnEvents: events };
    const lastTurn = { before, events };
    expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn }).replay).toBe(true);
    // No snapshot (e.g. after a reload): disabled.
    expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn: null }).replay).toBe(false);
  });

  it('disables End Turn/Undo/Replay and hides Home while playback is playing or replaying', () => {
    const before = boardState(rows);
    const run = { ...before, undo: [snapshot], lastTurnEvents: events };
    const lastTurn = { before, events };
    const none = { endTurn: false, undo: false, replay: false, home: false };
    for (const status of ['playing', 'replaying'] as const) {
      expect(hudButtons({ run, playback: { status, events, cursor: 0 }, lastTurn })).toEqual(none);
    }
  });

  it('disables End Turn/Undo/Replay outside planning, but keeps Home shown (e.g. levelCleared)', () => {
    const before = boardState(rows);
    const run = {
      ...before,
      undo: [snapshot],
      lastTurnEvents: events,
      phase: 'levelCleared' as const,
    };
    const lastTurn = { before, events };
    expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn })).toEqual({
      endTurn: false,
      undo: false,
      replay: false,
      home: true,
    });
  });

  describe('home (task 14 req. 5)', () => {
    it('hides Home while the run-mode wave-cleared overlay is up (phase waveCleared, idle)', () => {
      const run = { ...boardState(rows), mode: 'run' as const, phase: 'waveCleared' as const };
      expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn: null }).home).toBe(false);
    });

    it('shows Home for a level-mode waveCleared-shaped phase (never happens, but not the run condition)', () => {
      // Level mode never reaches `waveCleared` in practice, but Home's condition is `mode ===
      // 'run'` specifically, not the phase alone — documented via this direct check.
      const run = { ...boardState(rows), mode: 'level' as const, phase: 'waveCleared' as const };
      expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn: null }).home).toBe(true);
    });

    it('shows Home again once the wave-cleared overlay is gone and phase moves back to planning', () => {
      const run = { ...boardState(rows), mode: 'run' as const, phase: 'planning' as const };
      expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn: null }).home).toBe(true);
    });
  });
});
