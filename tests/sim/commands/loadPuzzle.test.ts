import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../../sim/commands/applyCommand';
import { parseGameData } from '../../../sim/data/load';
import { loadRawGameData } from '../../helpers/loadDataFiles';
import { fakeGameData, fakeRunState } from './fixtures';

const data = parseGameData(loadRawGameData());

function expectOk<T extends { ok: boolean }>(
  result: T,
): asserts result is T & { ok: true } {
  expect(result.ok).toBe(true);
}

describe('loadPuzzle', () => {
  it('builds a puzzle session from a playable catalog id', () => {
    const result = applyCommand(null, { type: 'loadPuzzle', puzzleId: 'warm-up' }, data);
    expectOk(result);
    expect(result.state.mode).toBe('puzzle');
    expect(result.state.puzzleId).toBe('warm-up');
    expect(result.state.phase).toBe('planning');
    expect(result.state.waveIndex).toBe(0);
    expect(result.state.board.cannons[2]).toBe(true);
    expect(result.state.board.robots).toMatchObject([{ lane: 2, hp: 1 }]);
    expect(result.state.baseHp).toBe(data.economy.baseHp);
  });

  it('starts Recipe at 1 HP so one leak is a loss', () => {
    const loaded = applyCommand(null, { type: 'loadPuzzle', puzzleId: 'recipe' }, data);
    expectOk(loaded);
    expect(loaded.state.baseHp).toBe(1);

    let state = loaded.state;
    let lostEvents: (typeof loaded.events) | undefined;
    for (let i = 0; i < 8; i++) {
      const next = applyCommand(state, { type: 'endTurn' }, data);
      expectOk(next);
      state = next.state;
      if (state.phase === 'lost') {
        lostEvents = next.events;
        break;
      }
    }
    expect(state.phase).toBe('lost');
    expect(lostEvents?.some((event) => event.type === 'RunLost')).toBe(true);
  });

  it('does not use the ladder wave list', () => {
    const result = applyCommand(null, { type: 'loadPuzzle', puzzleId: 'plus-party' }, data);
    expectOk(result);
    expect(result.state.pendingSpawns.length + result.state.board.robots.length).toBeGreaterThan(0);
  });

  it('throws for a locked or unknown id', () => {
    expect(() => applyCommand(null, { type: 'loadPuzzle', puzzleId: 'blue-room' }, data)).toThrow(
      /locked|unknown/,
    );
    expect(() => applyCommand(null, { type: 'loadPuzzle', puzzleId: 'nope' }, data)).toThrow(
      /unknown/,
    );
  });

  it('replaces any prior state and never requires a phase', () => {
    const prior = fakeRunState({ mode: 'run', phase: 'shop' });
    const result = applyCommand(prior, { type: 'loadPuzzle', puzzleId: 'odd-socks' }, data);
    expectOk(result);
    expect(result.state.mode).toBe('puzzle');
    expect(result.state.puzzleId).toBe('odd-socks');
  });
});

describe('puzzle nextWave', () => {
  it('is refused outside waveCleared', () => {
    const loaded = applyCommand(null, { type: 'loadPuzzle', puzzleId: 'plus-party' }, data);
    expectOk(loaded);
    const result = applyCommand(loaded.state, { type: 'nextWave' }, data);
    expect(result).toEqual({ ok: false, error: 'wrong_phase' });
  });
});

describe('fake fixtures still typecheck', () => {
  it('empty puzzle catalog is valid GameData', () => {
    expect(fakeGameData().puzzles.puzzles).toEqual([]);
  });
});
