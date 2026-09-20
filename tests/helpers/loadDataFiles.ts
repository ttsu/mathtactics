// Node-side disk loader for `/data/*.json`, used only by tests and CLIs. `/sim` must not
// import Node built-ins (TR §2, enforced by lint), so this reads the files and hands
// `parseGameData` (`/sim/data/load.ts`) plain parsed JSON — the same shape the browser build
// gets from Vite's `resolveJsonModule` imports.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '../../data');

const DATA_FILE_KEYS = [
  'tiles',
  'robots',
  'economy',
  'shop',
  'waves',
  'difficulty',
  'levels',
  'puzzles',
  'presentation',
] as const;

/** Reads every `/data/*.json` file into a `{ tiles, robots, ... }` object, keyed exactly as
 * `parseGameData` expects. */
export function loadRawGameData(): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const key of DATA_FILE_KEYS) {
    const text = readFileSync(resolve(DATA_DIR, `${key}.json`), 'utf-8');
    raw[key] = JSON.parse(text);
  }
  return raw;
}
