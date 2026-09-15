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
  describeEventSequenceFailureCompact,
  findPartialMismatch,
  matchEventSequence,
  type EventSequenceMatch,
  type PartialMismatch,
} from './match';
import type { Scenario } from './parse';

/** The `LevelDef` a scenario starts from: the shipped level named by `level:` (task 11), or one
 * built from the scenario's own `board`. */
function initialLevelDef(scenario: Scenario, data: GameData): LevelDef {
  if (scenario.level !== undefined) {
    const levelDef = data.levels.levels.find((level) => level.id === scenario.level);
    if (!levelDef) {
      throw new Error(`scenario level: unknown level id "${scenario.level}" (not in levels.json)`);
    }
    return levelDef;
  }
  if (scenario.baseValue === undefined) {
    throw new Error('scenario baseValue: required when the scenario has a "board"');
  }
  return {
    id: scenario.levelId,
    cannonLanes: scenario.cannonLanes,
    baseValue: scenario.baseValue,
    boardTiles: scenario.boardTiles,
    tray: scenario.tray,
    robots: scenario.robots,
  };
}

/**
 * Builds the scenario's initial `RunState`: `buildLevelState` (task 06) on the scenario's
 * starting `LevelDef` (see `initialLevelDef`), then scenario overrides applied in this order (task 08 interfaces
 * note): `coins`, `baseHp`, `seed`, `mode`, `waveIndex`, `turn`, `waiting` robots (`col: null`,
 * each with its own `maxHp`).
 */
export function buildScenarioState(scenario: Scenario, data: GameData): RunState {
  let state = buildLevelState(initialLevelDef(scenario, data), data);

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
 * that wasn't supposed to (`actual` set, `expected` unset or mismatched), the last command was
 * supposed to fail with `expected` but didn't (`actual` unset, `command` set), or `expectError`
 * was declared with no `commands` at all to produce it (`index: -1`, `command` unset). */
export interface ScenarioCommandFailure {
  index: number;
  command?: Command;
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

  // `expectError` names an error the *last* command must produce (see the ruling above) — with
  // no commands at all there is no last command to produce it, so it can never be satisfied
  // (review fix round 1, item 3: this used to pass silently).
  if (scenario.commands.length === 0 && scenario.expectError !== undefined) {
    commandFailure = { index: -1, expected: scenario.expectError };
  }

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

function describeCommandFailure(failure: ScenarioCommandFailure): string {
  const { index, command, actual, expected } = failure;
  if (command === undefined) {
    return `expectError "${expected}" was declared, but there are no commands to produce it.`;
  }
  if (actual === undefined) {
    return `command ${index} (${command.type}) was expected to fail with "${expected}", but succeeded.`;
  }
  if (expected !== undefined) {
    return `command ${index} (${command.type}) failed with "${actual}", expected "${expected}".`;
  }
  return `command ${index} (${command.type}) failed unexpectedly with "${actual}".`;
}

function describeStateMismatch(mismatch: PartialMismatch): string {
  return (
    `expectState mismatch at "${mismatch.path}": ` +
    `expected ${JSON.stringify(mismatch.expected)}, got ${JSON.stringify(mismatch.actual)}`
  );
}

/** Human-readable explanation of why `result` failed, sharing the command-failure and
 * expectState pieces between a verbose form (vitest — `describeScenarioFailure`, a full
 * pretty-printed event dump on an events mismatch) and a compact one (the CLI —
 * `describeScenarioFailureCompact`, one line per event; task 08 review fix round 1, item 2). */
function describeScenarioFailureWith(
  result: ScenarioRunResult,
  describeEvents: (
    actual: readonly GameEvent[],
    expected: Scenario['expectEvents'],
    match: EventSequenceMatch,
  ) => string,
): string {
  const lines: string[] = [];

  if (result.commandFailure) {
    lines.push(describeCommandFailure(result.commandFailure));
  }

  if (!result.eventsMatch.ok) {
    lines.push(describeEvents(result.events, result.scenario.expectEvents, result.eventsMatch));
  }

  if (result.stateMismatch) {
    lines.push(describeStateMismatch(result.stateMismatch));
  }

  return lines.join('\n');
}

/** Verbose failure description (vitest) — see `describeScenarioFailureWith`. */
export function describeScenarioFailure(result: ScenarioRunResult): string {
  return describeScenarioFailureWith(result, describeEventSequenceFailure);
}

/** Compact failure description (CLI) — see `describeScenarioFailureWith`. */
export function describeScenarioFailureCompact(result: ScenarioRunResult): string {
  return describeScenarioFailureWith(result, describeEventSequenceFailureCompact);
}
