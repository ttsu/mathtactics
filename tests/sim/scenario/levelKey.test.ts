// Unit tests for the scenario `level: <levelId>` key (task 11): a scenario may start from a shipped
// level in `levels.json` instead of a hand-written `board` — never both, never neither.

import { describe, expect, it } from 'vitest';
import type { LevelDef } from '../../../sim/data/schemas';
import { parseScenario } from '../../../sim/scenario/parse';
import { buildScenarioState, runScenario } from '../../../sim/scenario/run';
import { fakeGameData } from '../commands/fixtures';

const BLANK_BOARD = Array.from({ length: 5 }, () => '  - ". . . . . . . ."');

function yaml(lines: string[]): string {
  return lines.join('\n');
}

const LEVEL: LevelDef = {
  id: 'level-x',
  cannonLanes: [1],
  baseValue: 1,
  boardTiles: [{ lane: 1, col: 5, tileId: 'mul:3' }],
  tray: ['add:2'],
  robots: [{ lane: 1, col: 5, hp: 3, trait: { type: 'none' } }],
};

const data = fakeGameData({ levels: { levels: [LEVEL] } });

describe('parseScenario — level key', () => {
  it('accepts `level` with no board, and uses the level id as the levelId', () => {
    const scenario = parseScenario(yaml(['name: t', 'level: level-x']), 'some-file');
    expect(scenario.level).toBe('level-x');
    expect(scenario.levelId).toBe('level-x');
    expect(scenario.baseValue).toBeUndefined();
    expect(scenario.cannonLanes).toEqual([]);
    expect(scenario.tray).toEqual([]);
  });

  it('rejects `level` together with `board`', () => {
    const text = yaml(['name: t', 'level: level-x', 'board:', ...BLANK_BOARD]);
    expect(() => parseScenario(text)).toThrow(
      'scenario: "board"/"level" cannot be used together',
    );
  });

  it('rejects `level` together with `baseValue` or `tray`, naming each', () => {
    const text = yaml(['name: t', 'level: level-x', 'baseValue: 2', 'tray: [add:2]']);
    expect(() => parseScenario(text)).toThrow('"level" and "baseValue"/"tray" cannot be used');
  });

  it('rejects a scenario with neither `level` nor `board`', () => {
    expect(() => parseScenario(yaml(['name: t', 'baseValue: 1']))).toThrow(
      'scenario: needs "board" (with "baseValue"), "level: <levelId>", or "puzzle: <puzzleId>"',
    );
  });

  it('still requires `baseValue` with a `board`', () => {
    expect(() => parseScenario(yaml(['name: t', 'board:', ...BLANK_BOARD]))).toThrow(
      'scenario baseValue: required',
    );
  });
});

describe('buildScenarioState / runScenario — level key', () => {
  it('builds the initial state from the shipped level', () => {
    const state = buildScenarioState(parseScenario(yaml(['name: t', 'level: level-x'])), data);
    expect(state.levelId).toBe('level-x');
    expect(state.mode).toBe('level');
    expect(state.board.cannons).toEqual([false, true, false, false, false]);
    expect(state.board.robots).toMatchObject([{ lane: 1, col: 5, hp: 3 }]);
    expect(state.pieces['piece:0']?.tileId).toBe('mul:3');
    expect(state.tray).toEqual(['piece:1']);
  });

  it('still applies scenario overrides such as `coins` on top of the level', () => {
    const state = buildScenarioState(
      parseScenario(yaml(['name: t', 'level: level-x', 'coins: 9'])),
      data,
    );
    expect(state.coins).toBe(9);
  });

  it('throws a clear error for a level id not in levels.json', () => {
    const scenario = parseScenario(yaml(['name: t', 'level: nope']));
    expect(() => buildScenarioState(scenario, data)).toThrow(
      'scenario level: unknown level id "nope" (not in levels.json)',
    );
  });

  it('runs commands against the level and checks expectations', () => {
    const scenario = parseScenario(
      yaml([
        'name: t',
        'level: level-x',
        'commands:',
        '  - { type: placeTile, pieceId: "piece:1", to: { lane: 1, col: 1 } }',
        '  - endTurn',
        'expectEvents:',
        '  - { type: RobotDefeated, exact: true }',
        '  - { type: LevelCleared, levelId: level-x }',
        'expectState:',
        '  phase: levelCleared',
      ]),
    );
    expect(runScenario(scenario, data).pass).toBe(true);
  });
});
