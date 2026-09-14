import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../../sim/commands/applyCommand';
import type { Command, RunState } from '../../../sim/core/types';
import { deepFreeze, emptyCells, fakeGameData, fakeRunState } from './fixtures';

const data = fakeGameData();

function expectOk(result: ReturnType<typeof applyCommand>): asserts result is {
  ok: true;
  state: RunState;
  events: [];
} {
  if (!result.ok) {
    throw new Error(`expected ok, got error "${result.error}"`);
  }
}

describe('applyCommand — wrong_phase', () => {
  it('rejects every non-loadLevel command when state is null', () => {
    const commands: Command[] = [
      { type: 'placeTile', pieceId: 'p1', to: { lane: 0, col: 1 } },
      { type: 'moveTile', from: { lane: 0, col: 1 }, to: { lane: 0, col: 2 } },
      { type: 'returnTile', from: { lane: 0, col: 1 } },
      { type: 'moveCannon', fromLane: 0, toLane: 1 },
      { type: 'undo' },
      { type: 'endTurn' },
      { type: 'buyOffer', slot: 'cannon' },
      { type: 'leaveShop' },
      { type: 'newRun', seed: 'x' },
    ];
    for (const cmd of commands) {
      expect(applyCommand(null, cmd, data)).toEqual({ ok: false, error: 'wrong_phase' });
    }
  });

  it('rejects planning commands outside the planning phase', () => {
    const state = fakeRunState({ phase: 'shop', tray: ['p1'] });
    const result = applyCommand(
      state,
      { type: 'placeTile', pieceId: 'p1', to: { lane: 0, col: 1 } },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'wrong_phase' });
  });

  it('rejects buyOffer, leaveShop, newRun even during planning (not implemented until M3)', () => {
    const state = fakeRunState({ phase: 'planning' });
    const commands: Command[] = [
      { type: 'buyOffer', slot: 'cannon' },
      { type: 'leaveShop' },
      { type: 'newRun', seed: 'x' },
    ];
    for (const cmd of commands) {
      expect(applyCommand(state, cmd, data)).toEqual({ ok: false, error: 'wrong_phase' });
    }
  });
});

describe('applyCommand — placeTile', () => {
  it('places a tray tile into an empty tile cell and pushes an undo snapshot', () => {
    const state = fakeRunState({
      tray: ['p1'],
      pieces: { p1: { pieceId: 'p1', tileId: 'add:2' } },
    });
    const result = applyCommand(
      state,
      { type: 'placeTile', pieceId: 'p1', to: { lane: 1, col: 3 } },
      data,
    );
    expectOk(result);
    expect(result.events).toEqual([]);
    expect(result.state.board.cells[1]?.[3]).toBe('p1');
    expect(result.state.tray).toEqual([]);
    expect(result.state.undo).toEqual([
      { cells: emptyCells(), tray: ['p1'], cannons: state.board.cannons },
    ]);
  });

  it('rejects a target in the cannon-slot column (not a tile cell)', () => {
    const state = fakeRunState({ tray: ['p1'] });
    const result = applyCommand(
      state,
      { type: 'placeTile', pieceId: 'p1', to: { lane: 0, col: 0 } },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'not_a_tile_cell' });
  });

  it('rejects placing onto a cell containing an on-board robot', () => {
    const state = fakeRunState({
      tray: ['p1'],
      board: {
        cannons: [true, false, false, false, false],
        cells: emptyCells(),
        robots: [
          {
            robotId: 'r1',
            lane: 0,
            col: 3,
            hp: 1,
            maxHp: 1,
            trait: { type: 'none' },
            isBoss: false,
          },
        ],
      },
    });
    const result = applyCommand(
      state,
      { type: 'placeTile', pieceId: 'p1', to: { lane: 0, col: 3 } },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'cell_locked' });
  });

  it('rejects a piece that is not in the tray', () => {
    const state = fakeRunState({ tray: [] });
    const result = applyCommand(
      state,
      { type: 'placeTile', pieceId: 'missing', to: { lane: 0, col: 1 } },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'piece_not_in_tray' });
  });

  it('rejects placing onto an already-occupied cell', () => {
    const cells = emptyCells();
    cells[0]![1] = 'existing';
    const state = fakeRunState({
      tray: ['p1'],
      board: { cannons: [true, false, false, false, false], cells, robots: [] },
    });
    const result = applyCommand(
      state,
      { type: 'placeTile', pieceId: 'p1', to: { lane: 0, col: 1 } },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'cell_occupied' });
  });

  it('validation precedence: a robot standing on a tile reports cell_locked, not cell_occupied or piece_not_in_tray', () => {
    const cells = emptyCells();
    cells[0]![3] = 'existing-tile';
    const state = fakeRunState({
      tray: [], // the piece isn't even in the tray, to prove cell_locked still takes priority
      board: {
        cannons: [true, false, false, false, false],
        cells,
        robots: [
          {
            robotId: 'r1',
            lane: 0,
            col: 3,
            hp: 1,
            maxHp: 1,
            trait: { type: 'none' },
            isBoss: false,
          },
        ],
      },
    });
    const result = applyCommand(
      state,
      { type: 'placeTile', pieceId: 'p1', to: { lane: 0, col: 3 } },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'cell_locked' });
  });

  it('allows placing a tile in an unarmed lane (no cannon)', () => {
    const state = fakeRunState({
      tray: ['p1'],
      board: { cannons: [false, false, false, false, false], cells: emptyCells(), robots: [] },
    });
    const result = applyCommand(
      state,
      { type: 'placeTile', pieceId: 'p1', to: { lane: 2, col: 4 } },
      data,
    );
    expectOk(result);
    expect(result.state.board.cells[2]?.[4]).toBe('p1');
  });

  it('does not mutate a deeply frozen input state', () => {
    const state = deepFreeze(fakeRunState({ tray: ['p1'] }));
    expect(() =>
      applyCommand(state, { type: 'placeTile', pieceId: 'p1', to: { lane: 0, col: 1 } }, data),
    ).not.toThrow();
  });
});

describe('applyCommand — moveTile', () => {
  it('moves a board tile to an empty cell', () => {
    const cells = emptyCells();
    cells[0]![1] = 'p1';
    const state = fakeRunState({
      board: { cannons: [true, false, false, false, false], cells, robots: [] },
    });
    const result = applyCommand(
      state,
      { type: 'moveTile', from: { lane: 0, col: 1 }, to: { lane: 0, col: 2 } },
      data,
    );
    expectOk(result);
    expect(result.state.board.cells[0]?.[1]).toBeNull();
    expect(result.state.board.cells[0]?.[2]).toBe('p1');
  });

  it('rejects a target in the cannon-slot column', () => {
    const cells = emptyCells();
    cells[0]![1] = 'p1';
    const state = fakeRunState({
      board: { cannons: [true, false, false, false, false], cells, robots: [] },
    });
    const result = applyCommand(
      state,
      { type: 'moveTile', from: { lane: 0, col: 1 }, to: { lane: 0, col: 0 } },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'not_a_tile_cell' });
  });

  it('rejects when the source cell has no tile', () => {
    const state = fakeRunState({
      board: { cannons: [true, false, false, false, false], cells: emptyCells(), robots: [] },
    });
    const result = applyCommand(
      state,
      { type: 'moveTile', from: { lane: 0, col: 1 }, to: { lane: 0, col: 2 } },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'no_tile_here' });
  });

  it('rejects when the target cell already has a tile', () => {
    const cells = emptyCells();
    cells[0]![1] = 'p1';
    cells[0]![2] = 'p2';
    const state = fakeRunState({
      board: { cannons: [true, false, false, false, false], cells, robots: [] },
    });
    const result = applyCommand(
      state,
      { type: 'moveTile', from: { lane: 0, col: 1 }, to: { lane: 0, col: 2 } },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'cell_occupied' });
  });

  it('rejects when the source cell has an on-board robot (locked)', () => {
    const cells = emptyCells();
    cells[0]![1] = 'p1';
    const state = fakeRunState({
      board: {
        cannons: [true, false, false, false, false],
        cells,
        robots: [
          {
            robotId: 'r1',
            lane: 0,
            col: 1,
            hp: 1,
            maxHp: 1,
            trait: { type: 'none' },
            isBoss: false,
          },
        ],
      },
    });
    const result = applyCommand(
      state,
      { type: 'moveTile', from: { lane: 0, col: 1 }, to: { lane: 0, col: 2 } },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'cell_locked' });
  });

  it('rejects when the target cell has an on-board robot (locked)', () => {
    const cells = emptyCells();
    cells[0]![1] = 'p1';
    const state = fakeRunState({
      board: {
        cannons: [true, false, false, false, false],
        cells,
        robots: [
          {
            robotId: 'r1',
            lane: 0,
            col: 2,
            hp: 1,
            maxHp: 1,
            trait: { type: 'none' },
            isBoss: false,
          },
        ],
      },
    });
    const result = applyCommand(
      state,
      { type: 'moveTile', from: { lane: 0, col: 1 }, to: { lane: 0, col: 2 } },
      data,
    );
    expect(result).toEqual({ ok: false, error: 'cell_locked' });
  });
});

describe('applyCommand — returnTile', () => {
  it('returns a board tile to the end of the tray', () => {
    const cells = emptyCells();
    cells[0]![1] = 'p1';
    const state = fakeRunState({
      tray: ['p0'],
      board: { cannons: [true, false, false, false, false], cells, robots: [] },
    });
    const result = applyCommand(state, { type: 'returnTile', from: { lane: 0, col: 1 } }, data);
    expectOk(result);
    expect(result.state.board.cells[0]?.[1]).toBeNull();
    expect(result.state.tray).toEqual(['p0', 'p1']);
  });

  it('rejects when the source cell has no tile', () => {
    const state = fakeRunState({
      board: { cannons: [true, false, false, false, false], cells: emptyCells(), robots: [] },
    });
    const result = applyCommand(state, { type: 'returnTile', from: { lane: 0, col: 1 } }, data);
    expect(result).toEqual({ ok: false, error: 'no_tile_here' });
  });

  it('rejects when the source cell has an on-board robot (a tile under a robot cannot be returned)', () => {
    const cells = emptyCells();
    cells[0]![1] = 'p1';
    const state = fakeRunState({
      board: {
        cannons: [true, false, false, false, false],
        cells,
        robots: [
          {
            robotId: 'r1',
            lane: 0,
            col: 1,
            hp: 1,
            maxHp: 1,
            trait: { type: 'none' },
            isBoss: false,
          },
        ],
      },
    });
    const result = applyCommand(state, { type: 'returnTile', from: { lane: 0, col: 1 } }, data);
    expect(result).toEqual({ ok: false, error: 'cell_locked' });
  });
});

describe('applyCommand — moveCannon', () => {
  it('moves a cannon to an empty slot', () => {
    const state = fakeRunState({
      board: { cannons: [true, false, false, false, false], cells: emptyCells(), robots: [] },
    });
    const result = applyCommand(state, { type: 'moveCannon', fromLane: 0, toLane: 3 }, data);
    expectOk(result);
    expect(result.state.board.cannons).toEqual([false, false, false, true, false]);
  });

  it('rejects moving from a lane with no cannon', () => {
    const state = fakeRunState({
      board: { cannons: [true, false, false, false, false], cells: emptyCells(), robots: [] },
    });
    const result = applyCommand(state, { type: 'moveCannon', fromLane: 1, toLane: 2 }, data);
    expect(result).toEqual({ ok: false, error: 'no_cannon_here' });
  });

  it('rejects moving to an occupied slot', () => {
    const state = fakeRunState({
      board: { cannons: [true, true, false, false, false], cells: emptyCells(), robots: [] },
    });
    const result = applyCommand(state, { type: 'moveCannon', fromLane: 0, toLane: 1 }, data);
    expect(result).toEqual({ ok: false, error: 'slot_occupied' });
  });
});

describe('applyCommand — undo', () => {
  it('rejects undo when there is nothing to undo', () => {
    const state = fakeRunState({ undo: [] });
    const result = applyCommand(state, { type: 'undo' }, data);
    expect(result).toEqual({ ok: false, error: 'nothing_to_undo' });
  });

  it('place -> move -> return -> undo x3 restores the exact original state', () => {
    const original = fakeRunState({
      tray: ['p1'],
      pieces: { p1: { pieceId: 'p1', tileId: 'add:2' } },
    });

    let state = original;

    let result = applyCommand(
      state,
      { type: 'placeTile', pieceId: 'p1', to: { lane: 0, col: 1 } },
      data,
    );
    expectOk(result);
    state = result.state;

    result = applyCommand(
      state,
      { type: 'moveTile', from: { lane: 0, col: 1 }, to: { lane: 0, col: 4 } },
      data,
    );
    expectOk(result);
    state = result.state;

    result = applyCommand(state, { type: 'returnTile', from: { lane: 0, col: 4 } }, data);
    expectOk(result);
    state = result.state;

    expect(state.undo).toHaveLength(3);

    for (let i = 0; i < 3; i += 1) {
      result = applyCommand(state, { type: 'undo' }, data);
      expectOk(result);
      state = result.state;
    }

    expect(state).toEqual(original);
  });

  it('undo never touches coins, robots, or phase', () => {
    const state = fakeRunState({
      tray: ['p1'],
      coins: 42,
      pieces: { p1: { pieceId: 'p1', tileId: 'add:2' } },
      board: {
        cannons: [true, false, false, false, false],
        cells: emptyCells(),
        robots: [
          {
            robotId: 'r1',
            lane: 3,
            col: 6,
            hp: 5,
            maxHp: 5,
            trait: { type: 'none' },
            isBoss: false,
          },
        ],
      },
    });
    let result = applyCommand(
      state,
      { type: 'placeTile', pieceId: 'p1', to: { lane: 1, col: 1 } },
      data,
    );
    expectOk(result);
    result = applyCommand(result.state, { type: 'undo' }, data);
    expectOk(result);
    expect(result.state.coins).toBe(42);
    expect(result.state.phase).toBe('planning');
    expect(result.state.board.robots).toEqual(state.board.robots);
  });
});
