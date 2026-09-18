import { describe, expect, it } from 'vitest';
import {
  debugAddRobot,
  debugAddTile,
  debugJumpToLevel,
  debugJumpToWave,
} from '../../game/state/debug';
import { deepFreeze } from '../sim/commands/fixtures';
import { realData } from './boardFixtures';

const seed = 'debug-test-seed';

describe('debugJumpToLevel', () => {
  it('installs the shipped puzzle and leaves other levels alone', () => {
    const result = debugJumpToLevel(realData, 'level-3');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.mode).toBe('level');
    expect(result.run.levelId).toBe('level-3');
    expect(result.run.phase).toBe('planning');
    expect(result.run.tray).toHaveLength(2);
    expect(result.run.board.robots).toHaveLength(1);
    expect(result.run.board.robots[0]?.hp).toBe(9);
  });

  it('rejects an unknown level id', () => {
    expect(debugJumpToLevel(realData, 'level-99')).toEqual({
      ok: false,
      error: 'unknown level "level-99"',
    });
  });
});

describe('debugJumpToWave', () => {
  it('starts a fresh run on wave 1 (index 0)', () => {
    const result = debugJumpToWave(null, realData, 0, seed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.mode).toBe('run');
    expect(result.run.waveIndex).toBe(0);
    expect(result.run.phase).toBe('planning');
    expect(result.run.board.robots.length).toBeGreaterThan(0);
  });

  it('walks forward to wave 8 without leftover earlier robots', () => {
    const result = debugJumpToWave(null, realData, 7, seed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.waveIndex).toBe(7);
    expect(result.run.turn).toBe(1);
    expect(result.run.board.robots.every((robot) => robot.col === 7 || robot.col === null)).toBe(
      true,
    );
  });

  it('keeps tiles when jumping forward from an existing run', () => {
    const start = debugJumpToWave(null, realData, 0, seed);
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const withTile = debugAddTile(start.run, realData, 'mul:5', seed);
    expect(withTile.ok).toBe(true);
    if (!withTile.ok) return;
    const later = debugJumpToWave(withTile.run, realData, 3, seed);
    expect(later.ok).toBe(true);
    if (!later.ok) return;
    expect(later.run.waveIndex).toBe(3);
    expect(later.run.tray).toHaveLength(1);
    expect(later.run.pieces[later.run.tray[0]!]?.tileId).toBe('mul:5');
  });

  it('rejects a wave past the ladder', () => {
    expect(debugJumpToWave(null, realData, 99, seed)).toEqual({
      ok: false,
      error: 'unknown wave 100',
    });
  });
});

describe('debugAddTile', () => {
  it('grants a tile to the tray and does not mutate the input', () => {
    const start = debugJumpToLevel(realData, 'level-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    deepFreeze(start.run);
    const result = debugAddTile(start.run, realData, 'add:5', seed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(start.run.tray).toEqual([]);
    expect(result.run.tray).toHaveLength(1);
    expect(result.run.pieces[result.run.tray[0]!]?.tileId).toBe('add:5');
  });

  it('starts a run when there is none yet', () => {
    const result = debugAddTile(null, realData, 'sub:2', seed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.mode).toBe('run');
    expect(result.run.tray).toHaveLength(1);
  });

  it('rejects an unknown tile', () => {
    expect(debugAddTile(null, realData, 'add:99' as never, seed)).toEqual({
      ok: false,
      error: 'unknown tile "add:99"',
    });
  });
});

describe('debugAddRobot', () => {
  it('spawns the template on the rightmost free cell of the lane', () => {
    const start = debugJumpToLevel(realData, 'level-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const first = debugAddRobot(
      start.run,
      realData,
      { templateId: 'odd-only', lane: 0, hp: 12 },
      seed,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const added = first.run.board.robots.find((robot) => robot.robotId === 'robot:1');
    expect(added).toMatchObject({
      lane: 0,
      col: 7,
      hp: 12,
      maxHp: 12,
      trait: { type: 'oddOnly' },
      isBoss: false,
    });

    const second = debugAddRobot(
      first.run,
      realData,
      { templateId: 'bounce-back', lane: 0, hp: 8 },
      seed,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const behind = second.run.board.robots.find((robot) => robot.robotId === 'robot:2');
    expect(behind?.col).toBe(6);
    expect(behind?.trait).toEqual({ type: 'bounceBack' });
  });

  it('spawns a Boss on a 2x2 at col 6', () => {
    const start = debugJumpToLevel(realData, 'level-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const result = debugAddRobot(
      start.run,
      realData,
      { templateId: 'boss', lane: 1, hp: 1000 },
      seed,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const added = result.run.board.robots.find((robot) => robot.isBoss);
    expect(added).toMatchObject({
      lane: 1,
      col: 6,
      hp: 1000,
      maxHp: 1000,
      isBoss: true,
    });
  });

  it('rejects a Boss on the bottom lane', () => {
    expect(debugAddRobot(null, realData, { templateId: 'boss', lane: 4, hp: 1000 }, seed)).toEqual({
      ok: false,
      error: 'boss needs two lanes',
    });
  });

  it('rejects a bad template, lane, or hp', () => {
    expect(debugAddRobot(null, realData, { templateId: 'nope', lane: 0, hp: 10 }, seed)).toEqual({
      ok: false,
      error: 'unknown robot "nope"',
    });
    expect(debugAddRobot(null, realData, { templateId: 'basic', lane: 9, hp: 10 }, seed)).toEqual({
      ok: false,
      error: 'bad lane 9',
    });
    expect(debugAddRobot(null, realData, { templateId: 'basic', lane: 0, hp: 0 }, seed)).toEqual({
      ok: false,
      error: 'bad hp 0',
    });
  });
});
