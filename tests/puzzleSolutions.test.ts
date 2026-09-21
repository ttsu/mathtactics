// Every playable puzzle in `data/puzzles.json` has a known exact-kill solution in
// `/scenarios/puzzles`. Catalog stubs (no waves) must not have a solution file.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseGameData } from '../sim/data/load';
import { describeScenarioFailure, parseScenario, runScenario } from '../sim/scenario';
import { discoverScenarioFiles, scenarioSlugFromPath } from './helpers/scenarioFiles';
import { loadRawGameData } from './helpers/loadDataFiles';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUZZLE_SCENARIOS_DIR = resolve(HERE, '../scenarios/puzzles');

const data = parseGameData(loadRawGameData());
const scenarios = discoverScenarioFiles(PUZZLE_SCENARIOS_DIR).map((file) =>
  parseScenario(readFileSync(file, 'utf8'), scenarioSlugFromPath(file)),
);

function robotCount(puzzle: (typeof data.puzzles.puzzles)[number]): number {
  return (puzzle.waves ?? []).reduce(
    (sum, wave) => sum + wave.spawns.length + wave.robots.length,
    0,
  );
}

describe('puzzle book catalog', () => {
  it('ships 50 scenarios', () => {
    expect(data.puzzles.puzzles).toHaveLength(50);
  });

  it('ships 12 playable pack-1 puzzles', () => {
    const playable = data.puzzles.puzzles.filter((puzzle) => puzzle.waves !== undefined);
    expect(playable).toHaveLength(12);
    expect(playable.every((puzzle) => puzzle.pack === 1)).toBe(true);
  });

  it('every puzzle scenario names a playable catalog id', () => {
    const playable = new Set(
      data.puzzles.puzzles.filter((puzzle) => puzzle.waves).map((puzzle) => puzzle.id),
    );
    for (const scenario of scenarios) {
      expect(playable, scenario.name).toContain(scenario.puzzle);
    }
  });
});

describe('playable puzzles', () => {
  for (const puzzle of data.puzzles.puzzles.filter((entry) => entry.waves)) {
    it(`${puzzle.id} is solved with an exact kill on every robot`, () => {
      const matching = scenarios.filter((scenario) => scenario.puzzle === puzzle.id);
      expect(
        matching,
        `exactly one scenario in scenarios/puzzles uses puzzle: ${puzzle.id}`,
      ).toHaveLength(1);

      const result = runScenario(matching[0]!, data);
      expect(result.pass, result.pass ? undefined : describeScenarioFailure(result)).toBe(true);

      const defeats = result.events.filter((event) => event.type === 'RobotDefeated');
      expect(defeats).toHaveLength(robotCount(puzzle));
      expect(defeats.every((event) => event.exact)).toBe(true);
      expect(result.state.phase).toBe('won');
      expect(result.state.mode).toBe('puzzle');
    });
  }
});
