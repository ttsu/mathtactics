// `applyCommand`'s `endTurn` wiring to `resolveTurn` (TR §5, task 07 requirement 5).

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../../sim/commands/applyCommand';
import { buildLevelState } from '../../../sim/commands/level';
import { fakeGameData, fakeLevelDef, fakeRunState } from './fixtures';

const data = fakeGameData();

describe('applyCommand — endTurn', () => {
  it('requires phase planning', () => {
    const state = fakeRunState({ phase: 'shop' });
    expect(applyCommand(state, { type: 'endTurn' }, data)).toEqual({
      ok: false,
      error: 'wrong_phase',
    });
  });

  it('resolves the turn and returns its events', () => {
    const levelDef = fakeLevelDef({
      cannonLanes: [0],
      baseValue: 5,
      robots: [{ lane: 0, col: 7, hp: 5, trait: { type: 'none' } }],
    });
    const state = buildLevelState(levelDef, data);

    const result = applyCommand(state, { type: 'endTurn' }, data);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.state.phase).toBe('levelCleared');
    expect(result.state.lastTurnEvents).toEqual(result.events);
  });
});
