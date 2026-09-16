// Unit tests for the scenario YAML grammar and its error messages (task 08 review fix round 1,
// item 1). CLAUDE.md rule 2: the "malformed board rows produce errors naming the row and column"
// acceptance criterion must be proven by tests, not a manual check — this file is that proof.

import { describe, expect, it } from 'vitest';
import { parseScenario } from '../../../sim/scenario/parse';
import { findPartialMismatch } from '../../../sim/scenario/match';

/** A minimal, otherwise-valid 5×8 board with every tile cell empty. */
function blankBoard(): string[] {
  return Array.from({ length: 5 }, () => '. . . . . . . .');
}

function scenarioYaml(fields: Record<string, unknown>): string {
  const board = (fields.board as string[] | undefined) ?? blankBoard();
  const lines = [
    `name: ${(fields.name as string | undefined) ?? 'test scenario'}`,
    `baseValue: ${(fields.baseValue as number | undefined) ?? 1}`,
    'board:',
    ...board.map((row) => `  - "${row}"`),
  ];
  if (fields.tray !== undefined) {
    lines.push('tray:', ...(fields.tray as string[]).map((id) => `  - ${id}`));
  }
  if (fields.waiting !== undefined) {
    lines.push('waiting:');
    for (const entry of fields.waiting as Record<string, unknown>[]) {
      lines.push(`  - ${JSON.stringify(entry)}`);
    }
  }
  // Any other scalar field (e.g. `exactKills`, `mode`) — passed through verbatim.
  const HANDLED = new Set(['name', 'baseValue', 'board', 'tray', 'waiting']);
  for (const [key, value] of Object.entries(fields)) {
    if (HANDLED.has(key)) continue;
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push('commands: []');
  return lines.join('\n');
}

describe('parseScenario — grammar', () => {
  it('parses "." (empty) and "C" (cannon) in col 0', () => {
    const board = blankBoard();
    board[0] = 'C . . . . . . .';
    board[1] = '. . . . . . . .';
    const scenario = parseScenario(scenarioYaml({ board }));
    expect(scenario.cannonLanes).toEqual([0]);
  });

  it('parses "+N" as an add tile', () => {
    const board = blankBoard();
    board[0] = 'C +4 . . . . . .';
    const scenario = parseScenario(scenarioYaml({ board }));
    expect(scenario.boardTiles).toEqual([{ lane: 0, col: 1, tileId: 'add:4' }]);
  });

  it('parses "-N" (ascii hyphen) as a sub tile', () => {
    const board = blankBoard();
    board[0] = 'C -3 . . . . . .';
    const scenario = parseScenario(scenarioYaml({ board }));
    expect(scenario.boardTiles).toEqual([{ lane: 0, col: 1, tileId: 'sub:3' }]);
  });

  it('parses "−N" (unicode minus U+2212) as a sub tile, same as "-N"', () => {
    const board = blankBoard();
    board[0] = 'C −3 . . . . . .';
    const scenario = parseScenario(scenarioYaml({ board }));
    expect(scenario.boardTiles).toEqual([{ lane: 0, col: 1, tileId: 'sub:3' }]);
  });

  it('parses "xN" (ascii x) as a mul tile', () => {
    const board = blankBoard();
    board[0] = 'C x5 . . . . . .';
    const scenario = parseScenario(scenarioYaml({ board }));
    expect(scenario.boardTiles).toEqual([{ lane: 0, col: 1, tileId: 'mul:5' }]);
  });

  it('parses "×N" (unicode multiplication sign) as a mul tile, same as "xN"', () => {
    const board = blankBoard();
    board[0] = 'C ×5 . . . . . .';
    const scenario = parseScenario(scenarioYaml({ board }));
    expect(scenario.boardTiles).toEqual([{ lane: 0, col: 1, tileId: 'mul:5' }]);
  });

  it('parses a bare "R<hp>" robot with no tile and no trait', () => {
    const board = blankBoard();
    board[2] = '. . R13 . . . . .';
    const scenario = parseScenario(scenarioYaml({ board }));
    expect(scenario.robots).toEqual([{ lane: 2, col: 2, hp: 13, trait: { type: 'none' } }]);
    expect(scenario.boardTiles).toEqual([]);
  });

  it('parses "R<hp>[tile]" as a robot standing on a tile', () => {
    const board = blankBoard();
    board[2] = '. . R13[x3] . . . . .';
    const scenario = parseScenario(scenarioYaml({ board }));
    expect(scenario.robots).toEqual([{ lane: 2, col: 2, hp: 13, trait: { type: 'none' } }]);
    expect(scenario.boardTiles).toEqual([{ lane: 2, col: 2, tileId: 'mul:3' }]);
  });

  it('parses "R<hp>[tile]:odd" combining a tile and a trait suffix', () => {
    const board = blankBoard();
    board[2] = '. . R13[x3]:odd . . . . .';
    const scenario = parseScenario(scenarioYaml({ board }));
    expect(scenario.robots).toEqual([{ lane: 2, col: 2, hp: 13, trait: { type: 'oddOnly' } }]);
    expect(scenario.boardTiles).toEqual([{ lane: 2, col: 2, tileId: 'mul:3' }]);
  });

  it.each([
    ['bb', { type: 'bounceBack' }],
    ['odd', { type: 'oddOnly' }],
    ['even', { type: 'evenOnly' }],
    ['w2', { type: 'weakness', n: 2 }],
    ['w5', { type: 'weakness', n: 5 }],
    ['w10', { type: 'weakness', n: 10 }],
  ] as const)('parses trait suffix ":%s"', (code, trait) => {
    const board = blankBoard();
    board[2] = `. . R5:${code} . . . . .`;
    const scenario = parseScenario(scenarioYaml({ board }));
    expect(scenario.robots).toEqual([{ lane: 2, col: 2, hp: 5, trait }]);
  });

  it('normalizes the "endTurn"/"undo" string command shorthand', () => {
    const yamlText = [
      'name: t',
      'baseValue: 1',
      'board:',
      ...blankBoard().map((row) => `  - "${row}"`),
      'commands:',
      '  - endTurn',
      '  - undo',
    ].join('\n');
    const scenario = parseScenario(yamlText);
    expect(scenario.commands).toEqual([{ type: 'endTurn' }, { type: 'undo' }]);
  });

  it('passes the object form of a command through with its fields intact', () => {
    const yamlText = [
      'name: t',
      'baseValue: 1',
      'board:',
      ...blankBoard().map((row) => `  - "${row}"`),
      'commands:',
      '  - type: placeTile',
      '    pieceId: piece:0',
      '    to: { lane: 1, col: 2 }',
    ].join('\n');
    const scenario = parseScenario(yamlText);
    expect(scenario.commands).toEqual([
      { type: 'placeTile', pieceId: 'piece:0', to: { lane: 1, col: 2 } },
    ]);
  });

  it('derives levelId from sourceName when given, slugified', () => {
    const scenario = parseScenario(scenarioYaml({ name: 'Something Else' }), 'My File Name');
    expect(scenario.levelId).toBe('scenario:my-file-name');
  });

  it('falls back to slugifying name when sourceName is omitted', () => {
    const scenario = parseScenario(scenarioYaml({ name: 'Weird!! Name??' }));
    expect(scenario.levelId).toBe('scenario:weird-name');
  });
});

describe('parseScenario — errors', () => {
  it('names the row (1-based) and lane for a bad token count in that row', () => {
    const yamlText = [
      'name: t',
      'baseValue: 1',
      'board:',
      '  - ". . . . . . . ."',
      '  - ". . . . . . . ."',
      '  - "C R5 ."', // only 3 tokens, row 3 / lane 2
      '  - ". . . . . . . ."',
      '  - ". . . . . . . ."',
      'commands: []',
    ].join('\n');
    expect(() => parseScenario(yamlText)).toThrow(
      'scenario board row 3 (lane 2): expected 8 space-separated tokens, got 3',
    );
  });

  it('names the row, lane, and column for an unrecognized token', () => {
    const board = blankBoard();
    board[2] = 'C R5 Q . . . . .';
    expect(() => parseScenario(scenarioYaml({ board }))).toThrow(
      'scenario board row 3 (lane 2), col 2: unrecognized token "Q"',
    );
  });

  it('rejects a board with only 4 rows', () => {
    const yamlText = [
      'name: t',
      'baseValue: 1',
      'board:',
      '  - ". . . . . . . ."',
      '  - ". . . . . . . ."',
      '  - ". . . . . . . ."',
      '  - ". . . . . . . ."',
      'commands: []',
    ].join('\n');
    expect(() => parseScenario(yamlText)).toThrow('board must have exactly 5 lane rows');
  });

  it('rejects a board with 6 rows', () => {
    const yamlText = [
      'name: t',
      'baseValue: 1',
      'board:',
      '  - ". . . . . . . ."',
      '  - ". . . . . . . ."',
      '  - ". . . . . . . ."',
      '  - ". . . . . . . ."',
      '  - ". . . . . . . ."',
      '  - ". . . . . . . ."',
      'commands: []',
    ].join('\n');
    expect(() => parseScenario(yamlText)).toThrow('board must have exactly 5 lane rows');
  });

  it('rejects a non-"C"/"." token in col 0', () => {
    const board = blankBoard();
    board[1] = 'X . . . . . . .';
    expect(() => parseScenario(scenarioYaml({ board }))).toThrow(
      'scenario board row 2 (lane 1), col 0: col 0 must be "C" (cannon) or "." (empty), got "X"',
    );
  });

  it('rejects "C" outside col 0', () => {
    const board = blankBoard();
    board[1] = '. C . . . . . .';
    expect(() => parseScenario(scenarioYaml({ board }))).toThrow(
      'scenario board row 2 (lane 1), col 1: "C" is only valid in col 0',
    );
  });

  it('rejects a bad tile inside robot brackets', () => {
    const board = blankBoard();
    board[2] = 'C R5[Q] . . . . . .';
    expect(() => parseScenario(scenarioYaml({ board }))).toThrow(
      'scenario board row 3 (lane 2), col 1: invalid tile "Q" inside robot brackets',
    );
  });

  it('rejects an unknown trait code', () => {
    const board = blankBoard();
    board[2] = 'C R5:xyz . . . . . .';
    expect(() => parseScenario(scenarioYaml({ board }))).toThrow(
      'scenario board row 3 (lane 2), col 1: unknown trait code "xyz" ' +
        '(expected one of bb, odd, even, w2, w5, w10)',
    );
  });

  it('rejects a tray entry that is not a valid tile id', () => {
    expect(() => parseScenario(scenarioYaml({ tray: ['nope'] }))).toThrow(
      'scenario tray[0]: "nope" is not a valid tile id',
    );
  });

  it('rejects a waiting robot whose maxHp is below its hp', () => {
    expect(() => parseScenario(scenarioYaml({ waiting: [{ lane: 0, hp: 5, maxHp: 3 }] }))).toThrow(
      'scenario waiting[0]: maxHp (3) must be >= hp (5)',
    );
  });
});

describe('parseScenario — task 13 (mode: run)', () => {
  it('parses pendingSpawns entries, defaulting robot to "basic"', () => {
    const yamlText = [
      'name: t',
      'mode: run',
      'baseValue: 1',
      'board:',
      ...blankBoard().map((row) => `  - "${row}"`),
      'pendingSpawns:',
      '  - { turn: 3, lane: 2, hp: 7 }',
      '  - { turn: 5, lane: 1, hp: 4, robot: boss }',
      'commands: []',
    ].join('\n');
    const scenario = parseScenario(yamlText);
    expect(scenario.pendingSpawns).toEqual([
      { turn: 3, lane: 2, robotTemplateId: 'basic', hp: 7 },
      { turn: 5, lane: 1, robotTemplateId: 'boss', hp: 4 },
    ]);
  });

  it('defaults pendingSpawns to an empty array', () => {
    const scenario = parseScenario(scenarioYaml({}));
    expect(scenario.pendingSpawns).toEqual([]);
  });

  it('parses an exactKills override', () => {
    const scenario = parseScenario(scenarioYaml({ exactKills: 6 }));
    expect(scenario.exactKills).toBe(6);
  });

  it('leaves exactKills undefined when not given', () => {
    const scenario = parseScenario(scenarioYaml({}));
    expect(scenario.exactKills).toBeUndefined();
  });

  it('parses an inline waves override', () => {
    const yamlText = [
      'name: t',
      'mode: run',
      'baseValue: 1',
      'board:',
      ...blankBoard().map((row) => `  - "${row}"`),
      'waves:',
      '  - id: only-wave',
      '    spawns:',
      '      - { turn: 1, lane: 0, robot: basic, hp: [1, 1] }',
      'commands: []',
    ].join('\n');
    const scenario = parseScenario(yamlText);
    expect(scenario.waves).toEqual([
      { id: 'only-wave', spawns: [{ turn: 1, lane: 0, robot: 'basic', hp: [1, 1] }] },
    ]);
  });

  it('rejects an inline waves override with no turn-1 spawn, same rule as waves.json', () => {
    const yamlText = [
      'name: t',
      'mode: run',
      'baseValue: 1',
      'board:',
      ...blankBoard().map((row) => `  - "${row}"`),
      'waves:',
      '  - id: bad-wave',
      '    spawns:',
      '      - { turn: 2, lane: 0, robot: basic, hp: [1, 1] }',
      'commands: []',
    ].join('\n');
    expect(() => parseScenario(yamlText)).toThrow(
      'scenario waves[0].spawns: a wave needs a spawn on turn 1',
    );
  });

  it('leaves waves undefined when not given', () => {
    const scenario = parseScenario(scenarioYaml({}));
    expect(scenario.waves).toBeUndefined();
  });

  it('normalizes the "nextWave" string command shorthand', () => {
    const yamlText = [
      'name: t',
      'baseValue: 1',
      'board:',
      ...blankBoard().map((row) => `  - "${row}"`),
      'commands:',
      '  - nextWave',
    ].join('\n');
    const scenario = parseScenario(yamlText);
    expect(scenario.commands).toEqual([{ type: 'nextWave' }]);
  });

  it('normalizes the "{ newRun: <seed> }" object command shorthand', () => {
    const yamlText = [
      'name: t',
      'baseValue: 1',
      'board:',
      ...blankBoard().map((row) => `  - "${row}"`),
      'commands:',
      '  - newRun: my-seed',
    ].join('\n');
    const scenario = parseScenario(yamlText);
    expect(scenario.commands).toEqual([{ type: 'newRun', seed: 'my-seed' }]);
  });
});

describe('findPartialMismatch', () => {
  it('returns null when actual satisfies every key expected names', () => {
    expect(findPartialMismatch({ a: 1, b: { c: 2, d: 3 } }, { a: 1, b: { c: 2 } })).toBeNull();
  });

  it('reports the dotted path, expected value, and actual value of the first mismatch', () => {
    const mismatch = findPartialMismatch(
      { coins: 1, board: { robots: [{ hp: 4 }] } },
      { coins: 1, board: { robots: [{ hp: 9 }] } },
    );
    expect(mismatch).toEqual({ path: 'board.robots.0.hp', expected: 9, actual: 4 });
  });
});
