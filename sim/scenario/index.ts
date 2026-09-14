// Public surface of the scenario runner (GDD §15.1, TR §12, task 08). `game/state/testHandle.ts`
// imports `parseScenario` + `buildScenarioState` from here for `loadScenario`; `scripts/sim.ts`
// and `tests/scenarios.test.ts` import the rest for running and reporting.

export { parseScenario, type Scenario } from './parse';
export {
  buildScenarioState,
  describeScenarioFailure,
  formatEventCompact,
  runScenario,
  type ScenarioCommandFailure,
  type ScenarioRunResult,
} from './run';
export {
  describeEventSequenceFailure,
  findPartialMismatch,
  matchEventSequence,
  partialMatches,
  type EventSequenceMatch,
  type ExpectedEvent,
  type PartialMismatch,
} from './match';
