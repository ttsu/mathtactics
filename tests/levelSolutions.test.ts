// Task 11 req. 1: every shipped level in `data/levels.json` is proven solvable with an exact kill on
// every robot. Each level's scenario in `/scenarios/levels` (run by `tests/scenarios.test.ts` too)
// carries a known solution; an ordered-subsequence `expectEvents` can't rule out an extra,
// non-exact defeat, so this test checks the full event list: one `RobotDefeated` per robot in the
// level, every one `exact: true`, and the level cleared.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseGameData } from '../sim/data/load';
import { describeScenarioFailure, parseScenario, runScenario } from '../sim/scenario';
import { discoverScenarioFiles, scenarioSlugFromPath } from './helpers/scenarioFiles';
import { loadRawGameData } from './helpers/loadDataFiles';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEVEL_SCENARIOS_DIR = resolve(HERE, '../scenarios/levels');

const data = parseGameData(loadRawGameData());
const scenarios = discoverScenarioFiles(LEVEL_SCENARIOS_DIR).map((file) =>
  parseScenario(readFileSync(file, 'utf8'), scenarioSlugFromPath(file)),
);

describe('shipped levels', () => {
  it('ships 8 levels', () => {
    expect(data.levels.levels).toHaveLength(8);
  });

  it('every level scenario names a shipped level', () => {
    const ids = data.levels.levels.map((level) => level.id);
    for (const scenario of scenarios) {
      expect(ids, scenario.name).toContain(scenario.level);
    }
  });

  for (const level of data.levels.levels) {
    it(`${level.id} is solved with an exact kill on every robot`, () => {
      const matching = scenarios.filter((scenario) => scenario.level === level.id);
      expect(
        matching,
        `exactly one scenario in scenarios/levels uses level: ${level.id}`,
      ).toHaveLength(1);

      const result = runScenario(matching[0]!, data);
      expect(result.pass, result.pass ? undefined : describeScenarioFailure(result)).toBe(true);

      const defeats = result.events.filter((event) => event.type === 'RobotDefeated');
      expect(defeats).toHaveLength(level.robots.length);
      expect(defeats.every((event) => event.exact)).toBe(true);
      expect(result.state.phase).toBe('levelCleared');
    });
  }
});
