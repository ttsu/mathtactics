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
    // ⌂ Home is the only way out of `waveCleared` until task 16's overlay ships its ▶. Hiding it
    // here stranded the player: the wave is dead so no robot can be tapped, End Turn/Undo are
    // already off outside `planning`, and nothing else dispatches `nextWave`. Home stays shown in
    // every idle phase; only playback hides it.
    it('shows Home while a run sits in waveCleared (idle) — nothing else can leave that phase', () => {
      const run = { ...boardState(rows), mode: 'run' as const, phase: 'waveCleared' as const };
      expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn: null }).home).toBe(true);
    });

    it('shows Home for a level-mode waveCleared-shaped phase too', () => {
      const run = { ...boardState(rows), mode: 'level' as const, phase: 'waveCleared' as const };
      expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn: null }).home).toBe(true);
    });

    it('shows Home in planning', () => {
      const run = { ...boardState(rows), mode: 'run' as const, phase: 'planning' as const };
      expect(hudButtons({ run, playback: IDLE_PLAYBACK, lastTurn: null }).home).toBe(true);
    });

    it('hides Home only while playback is active, whatever the phase', () => {
      const run = { ...boardState(rows), mode: 'run' as const, phase: 'waveCleared' as const };
      expect(hudButtons({ run, playback: { status: 'playing', events, cursor: 0 }, lastTurn: null }).home).toBe(
        false,
      );
    });
  });
});
