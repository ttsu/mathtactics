// File discovery for scenario files (task 08, TR §12: `npm run sim -- <file-or-dir>`), shared by
// `scripts/sim.ts` and `tests/scenarios.test.ts`. Node-only (`node:fs`), so it lives in
// `tests/helpers` / is imported from `scripts/`, never from `/sim` (TR §2).

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Recursively finds `*.scenario.yaml`/`*.scenario.yml` files under `path`. If `path` names a
 * file directly, returns `[path]` unchanged (regardless of its extension) so `npm run sim --
 * <file>` always runs exactly the file given. */
export function discoverScenarioFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  if (!stat.isDirectory()) return [];

  const files: string[] = [];
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    const entryStat = statSync(full);
    if (entryStat.isDirectory()) {
      files.push(...discoverScenarioFiles(full));
    } else if (entryStat.isFile() && /\.scenario\.ya?ml$/i.test(entry)) {
      files.push(full);
    }
  }
  return files.sort();
}

/** The scenario's stable-id slug source (task 08 ruling: `scenario:<file-or-name-slug>`) — the
 * file's basename with its `.scenario.yaml`/`.yml` extension stripped. */
export function scenarioSlugFromPath(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  return base.replace(/\.scenario\.ya?ml$/i, '');
}
