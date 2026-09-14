// Unit tests for `runScenario`'s `expectError` handling (task 08 review fix round 1, item 3):
// `expectError` used to pass silently whenever it was never actually checked against a real
// command outcome. Covers both ways that could happen: no commands at all, and a scenario whose
// last (and only) command simply succeeds — plus the happy path, for contrast.

import { describe, expect, it } from 'vitest';
import { parseScenario } from '../../../sim/scenario/parse';
import { runScenario } from '../../../sim/scenario/run';
import { fakeGameData } from '../commands/fixtures';

function blankBoard(): string[] {
  return Array.from({ length: 5 }, () => '. . . . . . . .');
}

function yaml(lines: string[]): string {
  return lines.join('\n');
}

describe('runScenario — expectError', () => {
  it('fails when expectError is declared but there are no commands to produce it', () => {
    const scenario = parseScenario(
      yaml([
        'name: t',
        'baseValue: 1',
        'board:',
        ...blankBoard().map((row) => `  - "${row}"`),
        'expectError: cell_locked',
        'commands: []',
      ]),
    );

    const result = runScenario(scenario, fakeGameData());

    expect(result.pass).toBe(false);
    expect(result.commandFailure).toEqual({ index: -1, expected: 'cell_locked' });
  });

  it('fails when the expected error never occurs because every command succeeds', () => {
    const scenario = parseScenario(
      yaml([
        'name: t',
        'baseValue: 1',
        'board:',
        ...blankBoard().map((row) => `  - "${row}"`),
        'expectError: cell_locked',
        'commands:',
        '  - endTurn',
      ]),
    );

    const result = runScenario(scenario, fakeGameData());

    expect(result.pass).toBe(false);
    expect(result.commandFailure).toEqual({
      index: 0,
      command: { type: 'endTurn' },
      expected: 'cell_locked',
    });
  });

  it('passes when the last command fails with exactly the expected error', () => {
    const board = blankBoard();
    board[0] = 'C . R5 . . . . .'; // a robot locks (0, 2)
    const scenario = parseScenario(
      yaml([
        'name: t',
        'baseValue: 1',
        'tray:',
        '  - add:5',
        'board:',
        ...board.map((row) => `  - "${row}"`),
        'commands:',
        '  - type: placeTile',
        '    pieceId: piece:0',
        '    to: { lane: 0, col: 2 }',
        'expectError: cell_locked',
      ]),
    );

    const result = runScenario(scenario, fakeGameData());

    expect(result.pass).toBe(true);
    expect(result.commandFailure).toBeNull();
  });
});
