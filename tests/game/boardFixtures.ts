// Shared fixtures for Phaser-free board logic tests (task 09): real /data plus scenario-built
// states, so board tests read like the scenario files they mirror (TR §12 grammar).
import { parseGameData } from '../../sim/data/load';
import type { GameData } from '../../sim/data/schemas';
import type { RunState } from '../../sim/core/types';
import { buildScenarioState, parseScenario } from '../../sim/scenario';
import { loadRawGameData } from '../helpers/loadDataFiles';

export const realData: GameData = parseGameData(loadRawGameData());

/** Builds a planning state from board rows (col0..col7 tokens) and an optional tray. */
export function boardState(rows: string[], tray: string[] = []): RunState {
  const yaml = [
    'name: board fixture',
    'baseValue: 3',
    `tray: [${tray.join(', ')}]`,
    'board:',
    ...rows.map((row) => `  - "${row}"`),
  ].join('\n');
  return buildScenarioState(parseScenario(yaml), realData);
}

/** Builds a `mode: run` planning state (task 15) from board rows, with extra raw scenario YAML
 * lines (e.g. `pendingSpawns:`, `waves:`, `baseHp:`) appended so a run-mode turn (advance,
 * detonate, spawn) can be resolved from it. */
export function runState(rows: string[], extraYaml: string[] = []): RunState {
  const yaml = [
    'name: run board fixture',
    'mode: run',
    'baseValue: 3',
    'board:',
    ...rows.map((row) => `  - "${row}"`),
    ...extraYaml,
  ].join('\n');
  return buildScenarioState(parseScenario(yaml), realData);
}
