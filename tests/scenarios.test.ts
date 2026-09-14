// Generates one vitest test per scenario file (task 08 requirement 4) so `npm test` covers every
// scenario alongside the rest of the suite.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseGameData } from '../sim/data/load';
import { describeScenarioFailure, parseScenario, runScenario } from '../sim/scenario';
import { discoverScenarioFiles, scenarioSlugFromPath } from './helpers/scenarioFiles';
import { loadRawGameData } from './helpers/loadDataFiles';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_DIR = resolve(HERE, '../scenarios');

const data = parseGameData(loadRawGameData());
const files = discoverScenarioFiles(SCENARIOS_DIR);

describe('scenarios', () => {
  it('found at least one scenario file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${scenarioSlugFromPath(file)} (${file})`, () => {
      const yamlText = readFileSync(file, 'utf8');
      const scenario = parseScenario(yamlText, scenarioSlugFromPath(file));
      const result = runScenario(scenario, data);
      expect(result.pass, result.pass ? undefined : describeScenarioFailure(result)).toBe(true);
    });
  }
});
