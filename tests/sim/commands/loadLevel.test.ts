import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../../sim/commands/applyCommand';
import { buildLevelState } from '../../../sim/commands/level';
import { parseGameData } from '../../../sim/data/load';
import type { RunState } from '../../../sim/core/types';
import { fakeGameData, fakeLevelDef, fakeRunState } from './fixtures';
import { fakeShop } from '../../helpers/shop';
import { fakeDragSettings, fakeScreenSettings } from '../../helpers/dragSettings';
import {
  fakeDangerSettings,
  fakeHintsSettings,
  fakeHudSettings,
  fakePacingSettings,
  fakePlaybackSettings,
  fakeTraitSettings,
} from '../../helpers/playbackSettings';

function expectOk(result: ReturnType<typeof applyCommand>): asserts result is {
  ok: true;
  state: RunState;
  events: [];
} {
  if (!result.ok) {
    throw new Error(`expected ok, got error "${result.error}"`);
  }
}

describe('buildLevelState', () => {
  it('builds a fresh planning-phase RunState in level mode', () => {
    const level = fakeLevelDef({
      id: 'lvl-a',
      cannonLanes: [2],
      baseValue: 1,
      boardTiles: [{ lane: 0, col: 3, tileId: 'add:5' }],
      tray: ['add:2', 'mul:3'],
      robots: [
        { lane: 0, col: 7, hp: 9, trait: { type: 'none' } },
        { lane: 1, col: 6, hp: 3, trait: { type: 'none' } },
      ],
    });
    const data = fakeGameData();

    const state = buildLevelState(level, data);

    expect(state.mode).toBe('level');
    expect(state.levelId).toBe('lvl-a');
    expect(state.phase).toBe('planning');
    expect(state.waveIndex).toBe(0);
    expect(state.turn).toBe(1);
    expect(state.seed).toBe('level:lvl-a');
    expect(state.cannonBaseValue).toBe(1);
    expect(state.baseHp).toBe(data.economy.baseHp);
    expect(state.coins).toBe(data.economy.startCoins);
    expect(state.schemaVersion).toBe(data.economy.schemaVersion);
    expect(state.board.cannons).toEqual([false, false, true, false, false]);
    expect(state.pendingSpawns).toEqual([]);
    expect(state.undo).toEqual([]);
    expect(state.lastTurnEvents).toEqual([]);
    expect(state.shop).toBeNull();
  });

  it('pre-places board tiles as owned TilePieces at their cells', () => {
    const level = fakeLevelDef({
      boardTiles: [
        { lane: 0, col: 3, tileId: 'add:5' },
        { lane: 2, col: 6, tileId: 'mul:3' },
      ],
      tray: [],
      robots: [],
    });
    const state = buildLevelState(level, fakeGameData());

    const pieceIdAt03 = state.board.cells[0]?.[3];
    const pieceIdAt26 = state.board.cells[2]?.[6];
    expect(pieceIdAt03).toBeTruthy();
    expect(pieceIdAt26).toBeTruthy();
    expect(pieceIdAt03).not.toBe(pieceIdAt26);
    expect(state.pieces[pieceIdAt03 as string]).toEqual({ pieceId: pieceIdAt03, tileId: 'add:5' });
    expect(state.pieces[pieceIdAt26 as string]).toEqual({ pieceId: pieceIdAt26, tileId: 'mul:3' });
  });

  it('puts tray tile ids into the tray as owned TilePieces, in order', () => {
    const level = fakeLevelDef({ boardTiles: [], tray: ['add:2', 'add:5', 'mul:3'], robots: [] });
    const state = buildLevelState(level, fakeGameData());

    expect(state.tray).toHaveLength(3);
    expect(state.tray[0]).not.toBe(state.tray[1]);
    expect(state.pieces[state.tray[0] as string]?.tileId).toBe('add:2');
    expect(state.pieces[state.tray[1] as string]?.tileId).toBe('add:5');
    expect(state.pieces[state.tray[2] as string]?.tileId).toBe('mul:3');
  });

  it('assigns every piece and robot a stable, unique id via nextIds', () => {
    const level = fakeLevelDef({
      boardTiles: [{ lane: 0, col: 3, tileId: 'add:5' }],
      tray: ['add:2'],
      robots: [
        { lane: 0, col: 7, hp: 1, trait: { type: 'none' } },
        { lane: 1, col: 7, hp: 1, trait: { type: 'none' } },
      ],
    });
    const state = buildLevelState(level, fakeGameData());

    expect(Object.keys(state.pieces)).toHaveLength(2);
    expect(state.board.robots).toHaveLength(2);
    expect(state.board.robots[0]?.robotId).not.toBe(state.board.robots[1]?.robotId);
    expect(state.nextIds.piece).toBe(2);
    expect(state.nextIds.robot).toBe(2);
    expect(state.nextIds.ball).toBe(0);
  });

  it('builds stationary robots at full HP with the requested trait, defaulting to none', () => {
    const level = fakeLevelDef({
      robots: [{ lane: 2, col: 5, hp: 8, trait: { type: 'weakness', n: 2 } }],
    });
    const state = buildLevelState(level, fakeGameData());

    expect(state.board.robots).toEqual([
      {
        robotId: state.board.robots[0]?.robotId,
        lane: 2,
        col: 5,
        hp: 8,
        maxHp: 8,
        trait: { type: 'weakness', n: 2 },
        isBoss: false,
      },
    ]);
  });

  it('is deterministic: two builds from the same level def produce deep-equal states', () => {
    const level = fakeLevelDef({
      boardTiles: [{ lane: 0, col: 3, tileId: 'add:5' }],
      tray: ['add:2'],
      robots: [{ lane: 0, col: 7, hp: 4, trait: { type: 'none' } }],
    });
    const data = fakeGameData();
    expect(buildLevelState(level, data)).toEqual(buildLevelState(level, data));
  });
});

describe('applyCommand — loadLevel', () => {
  it('installs the level regardless of the current phase or state', () => {
    const level = fakeLevelDef({ id: 'lvl-b' });
    const data = fakeGameData({ levels: { levels: [level] } });

    for (const priorState of [
      null,
      fakeRunState({ phase: 'won' }),
      fakeRunState({ phase: 'lost' }),
      fakeRunState({ phase: 'shop' }),
    ]) {
      const result = applyCommand(priorState, { type: 'loadLevel', levelId: 'lvl-b' }, data);
      expectOk(result);
      expect(result.state.levelId).toBe('lvl-b');
      expect(result.state.phase).toBe('planning');
      expect(result.events).toEqual([]);
    }
  });

  it('throws for an unknown levelId (a data/programmer error, not a player error)', () => {
    const data = fakeGameData({ levels: { levels: [fakeLevelDef({ id: 'known' })] } });
    expect(() => applyCommand(null, { type: 'loadLevel', levelId: 'missing' }, data)).toThrow(
      /missing/,
    );
  });

  it('round-trips through the real levels.json zod schema', () => {
    const raw = {
      tiles: [
        { id: 'add:2', kind: 'add', n: 2, priceCategory: 'add', color: 'green', starred: false },
      ],
      robots: [{ id: 'basic', trait: { type: 'none' }, isBoss: false }],
      economy: {
        schemaVersion: 1,
        baseHp: 100,
        startCoins: 0,
        startCannonLane: 2,
        startBaseValue: 1,
        maxCannons: 5,
        income: { kill: 1, exactKill: 2, waveCleared: 3 },
      },
      shop: fakeShop(),
      waves: {
        waves: [{ id: 'wave-1', spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [1, 1] }] }],
      },
      levels: {
        levels: [
          {
            id: 'lvl-parsed',
            cannonLanes: [0],
            baseValue: 1,
            boardTiles: [],
            tray: ['add:2'],
            robots: [{ lane: 0, col: 7, hp: 1 }],
          },
        ],
      },
      presentation: {
        pacing: fakePacingSettings(),
        playback: fakePlaybackSettings(),
        tileColors: { green: '#0f0', blue: '#00f', orange: '#f80' },
        drag: fakeDragSettings(),
        screens: fakeScreenSettings(),
        danger: fakeDangerSettings(),
        hud: fakeHudSettings(),
        traits: fakeTraitSettings(),
        hints: fakeHintsSettings(),
      },
    };
    const data = parseGameData(raw);

    const result = applyCommand(null, { type: 'loadLevel', levelId: 'lvl-parsed' }, data);
    expectOk(result);
    expect(result.state.board.robots).toEqual([
      {
        robotId: result.state.board.robots[0]?.robotId,
        lane: 0,
        col: 7,
        hp: 1,
        maxHp: 1,
        trait: { type: 'none' },
        isBoss: false,
      },
    ]);
  });
});
