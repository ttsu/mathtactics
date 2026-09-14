// Scenario runner (GDD §15.1, TR §12, task 08): builds a scenario's initial `RunState` (reusing
// task 06's `buildLevelState`), applies its `commands` through the real `applyCommand`, and
// compares the result against `expectEvents`/`expectState`/`expectError`. Pure — no I/O, no
// printing (that's `scripts/sim.ts`'s job).

import { createStreams } from '../core/rng';
import type { Command, CommandError, GameEvent, Robot, RunState } from '../core/types';
import { applyCommand } from '../commands/applyCommand';
import { allocateRobotId } from '../commands/ids';
import { buildLevelState } from '../commands/level';
import type { GameData, LevelDef } from '../data/schemas';
import {
  describeEventSequenceFailure,
  findPartialMismatch,
  matchEventSequence,
  type EventSequenceMatch,
  type PartialMismatch,
} from './match';
import type { Scenario } from './parse';

/**
 * Builds the scenario's initial `RunState`: a `LevelDef` built from the parsed board (reusing
 * `buildLevelState`, task 06), then scenario overrides applied in this order (task 08 interfaces
 * note): `coins`, `baseHp`, `seed`, `mode`, `waveIndex`, `turn`, `waiting` robots (`col: null`,
 * each with its own `maxHp`).
 */
export function buildScenarioState(scenario: Scenario, data: GameData): RunState {
  const levelDef: LevelDef = {
    id: scenario.levelId,
    cannonLanes: scenario.cannonLanes,
    baseValue: scenario.baseValue,
    boardTiles: scenario.boardTiles,
    tray: scenario.tray,
    robots: scenario.robots,
  };

  let state = buildLevelState(levelDef, data);

  state = {
    ...state,
    coins: scenario.coins ?? state.coins,
    baseHp: scenario.baseHp ?? state.baseHp,
    seed: scenario.seed ?? state.seed,
    rng: scenario.seed !== undefined ? createStreams(scenario.seed) : state.rng,
    mode: scenario.mode,
    waveIndex: scenario.waveIndex ?? state.waveIndex,
    turn: scenario.turn ?? state.turn,
  };

  let nextIds = state.nextIds;
  const waitingRobots: Robot[] = [];
  for (const entry of scenario.waiting) {
    const [robotId, next] = allocateRobotId(nextIds);
    nextIds = next;
    waitingRobots.push({
      robotId,
      lane: entry.lane,
      col: null,
      hp: entry.hp,
      maxHp: entry.maxHp,
      trait: entry.trait,
      isBoss: false,
    });
  }

  return {
    ...state,
    nextIds,
    board: { ...state.board, robots: [...state.board.robots, ...waitingRobots] },
  };
}

/** Describes why a scenario's `commands` list didn't behave as expected: either a command failed
 * that wasn't supposed to (`actual` set, `expected` unset or mismatched), or the last command was
 * supposed to fail with `expected` but didn't (`actual` unset). */
export interface ScenarioCommandFailure {
  index: number;
  command: Command;
  actual?: CommandError;
  expected?: CommandError;
}

export interface ScenarioRunResult {
  scenario: Scenario;
  /** Final `RunState`, after every command up to (and not including) any failure. */
  state: RunState;
  /** Events from every successful command in `commands` (only `endTurn` ever produces any),
   * concatenated in order. */
  events: GameEvent[];
  eventsMatch: EventSequenceMatch;
  stateMismatch: PartialMismatch | null;
  commandFailure: ScenarioCommandFailure | null;
  pass: boolean;
}

/**
 * Runs one parsed scenario against `data`: builds its initial state, applies `commands` in order,
 * then checks `expectEvents` (ordered partial subsequence), `expectState` (partial deep match),
 * and `expectError` (task 08 ruling: matched only against the *last* command — every earlier
 * command must succeed, and if `expectError` is absent every command, including the last, must
 * succeed).
 */
export function runScenario(scenario: Scenario, data: GameData): ScenarioRunResult {
  let state = buildScenarioState(scenario, data);
  const events: GameEvent[] = [];
  let commandFailure: ScenarioCommandFailure | null = null;

  for (let i = 0; i < scenario.commands.length; i++) {
    const command = scenario.commands[i]!;
    const isLast = i === scenario.commands.length - 1;
    const result = applyCommand(state, command, data);

    if (result.ok) {
      state = result.state;
      events.push(...result.events);
      if (isLast && scenario.expectError !== undefined) {
        commandFailure = { index: i, command, expected: scenario.expectError };
        break;
      }
    } else {
      if (isLast && scenario.expectError === result.error) {
        break; // The expected failure happened — stop here, nothing more to apply.
      }
      commandFailure = { index: i, command, actual: result.error, expected: scenario.expectError };
      break;
    }
  }

  const eventsMatch = matchEventSequence(events, scenario.expectEvents);
  const stateMismatch =
    scenario.expectState !== undefined ? findPartialMismatch(state, scenario.expectState) : null;

  const pass = commandFailure === null && eventsMatch.ok && stateMismatch === null;

  return { scenario, state, events, eventsMatch, stateMismatch, commandFailure, pass };
}

/** One line per event, compact enough to scan a whole run at once (task 08 requirement 3). */
export function formatEventCompact(event: GameEvent): string {
  const { step, group, type, ...rest } = event;
  const fields = Object.entries(rest)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');
  return `[${step}] ${group} ${type}${fields ? ' ' + fields : ''}`;
}

/** Human-readable explanation of why `result` failed — reused by `scripts/sim.ts` and
 * `tests/scenarios.test.ts` so the CLI and vitest failure output agree. */
export function describeScenarioFailure(result: ScenarioRunResult): string {
  const lines: string[] = [];

  if (result.commandFailure) {
    const { index, command, actual, expected } = result.commandFailure;
    if (actual === undefined) {
      lines.push(
        `command ${index} (${command.type}) was expected to fail with "${expected}", but succeeded.`,
      );
    } else if (expected !== undefined) {
      lines.push(`command ${index} (${command.type}) failed with "${actual}", expected "${expected}".`);
    } else {
      lines.push(`command ${index} (${command.type}) failed unexpectedly with "${actual}".`);
    }
  }

  if (!result.eventsMatch.ok) {
    lines.push(
      describeEventSequenceFailure(result.events, result.scenario.expectEvents, result.eventsMatch),
    );
  }

  if (result.stateMismatch) {
    lines.push(
      `expectState mismatch at "${result.stateMismatch.path}": ` +
        `expected ${JSON.stringify(result.stateMismatch.expected)}, ` +
        `got ${JSON.stringify(result.stateMismatch.actual)}`,
    );
  }

  return lines.join('\n');
}
