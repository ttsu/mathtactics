import { describe, expect, it } from 'vitest';
import { IDLE_PLAYBACK } from '../../game/state/store';
import { hudButtons } from '../../game/ui/hudButtons';
import type { PlanningSnapshot } from '../../sim/core/types';
import { boardState } from './boardFixtures';

const rows = [
  'C . . . . . . .',
  '. . . . . . . .',
  '. . . . . . . .',
  '. . . . . . . .',
  '. . . . . . . .',
];
const snapshot: PlanningSnapshot = { cells: [], tray: [], cannons: [] };

describe('hudButtons', () => {
  it('disables both with no run', () => {
    expect(hudButtons({ run: null, playback: IDLE_PLAYBACK })).toEqual({
      endTurn: false,
      undo: false,
    });
  });

  it('enables End Turn in planning, and Undo only with undo history', () => {
    const run = boardState(rows);
    expect(hudButtons({ run, playback: IDLE_PLAYBACK })).toEqual({ endTurn: true, undo: false });
    expect(hudButtons({ run: { ...run, undo: [snapshot] }, playback: IDLE_PLAYBACK })).toEqual({
      endTurn: true,
      undo: true,
    });
  });

  it('disables both while playback is playing or outside planning', () => {
    const run = { ...boardState(rows), undo: [snapshot] };
    const playing = { status: 'playing' as const, events: [], cursor: 0 };
    expect(hudButtons({ run, playback: playing })).toEqual({ endTurn: false, undo: false });
    expect(hudButtons({ run: { ...run, phase: 'levelCleared' }, playback: IDLE_PLAYBACK })).toEqual(
      { endTurn: false, undo: false },
    );
  });
});
