#!/usr/bin/env -S npx tsx
// Scenario runner CLI (TR §12, §15.1 item 3, task 08). Thin: file discovery + printing only —
// every rule lives in `/sim/scenario` (`parse.ts` + `run.ts`).
//
// Run via `tsx` (chosen over `node --experimental-strip-types`, which is still marked
// experimental on Node 24 and doesn't handle non-type-only transforms some scenario/CLI
// code may eventually need; `tsx` is a stable, zero-config way to run TS files directly).
//
// Usage: npm run sim -- <file-or-dir> [<file-or-dir> ...]

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { parseGameData } from '../sim/data/load';
import { describeScenarioFailureCompact, parseScenario, runScenario } from '../sim/scenario';
import { discoverScenarioFiles, scenarioSlugFromPath } from '../tests/helpers/scenarioFiles';
import { loadRawGameData } from '../tests/helpers/loadDataFiles';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('usage: npm run sim -- <file-or-dir> [<file-or-dir> ...]');
  process.exit(1);
}

const files = args.flatMap((arg) => discoverScenarioFiles(arg));
if (files.length === 0) {
  console.error(`no scenario files found among: ${args.join(', ')}`);
  process.exit(1);
}

const data = parseGameData(loadRawGameData());

let failures = 0;
for (const file of files) {
  const rel = relative(process.cwd(), file);

  try {
    const yamlText = readFileSync(file, 'utf8');
    const scenario = parseScenario(yamlText, scenarioSlugFromPath(file));
    const result = runScenario(scenario, data);

    if (result.pass) {
      console.log(`✔ ${rel} — ${scenario.name}`);
      continue;
    }

    failures++;
    console.log(`✘ ${rel} — ${scenario.name}`);
    for (const line of describeScenarioFailureCompact(result).split('\n')) {
      console.log(`  ${line}`);
    }
  } catch (err) {
    failures++;
    console.log(`✘ ${rel}`);
    console.log(`  ${(err as Error).message}`);
  }
}

console.log(`\n${files.length - failures}/${files.length} scenarios passed.`);
process.exit(failures > 0 ? 1 : 0);
