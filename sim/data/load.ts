// Validating loader for /data (GDD §13, TR §9). `parseGameData` is pure and framework-free —
// it takes already-parsed JSON, not file paths, so it works from either side: the browser
// build imports JSON via Vite (`resolveJsonModule`) and the Node-side test/CLI helper reads
// the files from disk (that disk-reading helper lives in `/tests`, not here — `/sim` may not
// import Node built-ins, TR §2).

import { GameDataSchema, type GameData } from './schemas';

/** Formats a Zod issue path like `[3].n` or `income.kill` (array indices bracketed, object
 * keys dot-separated) for readable error messages. */
function formatPath(path: (string | number)[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return acc.length === 0 ? segment : `${acc}.${segment}`;
  }, '');
}

/**
 * Validates the combined `/data` content. `raw` is keyed by file base name (`tiles`, `robots`,
 * `economy`, `shop`, `waves`, `levels`, `presentation`), each value the file's parsed JSON.
 *
 * Pure; throws a plain `Error` naming the offending file and the path within it on the first
 * validation failure found, e.g. `tiles.json: [3].n: mul n must be 2-10`.
 */
export function parseGameData(raw: Record<string, unknown>): GameData {
  const result = GameDataSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }

  const issue = result.error.issues[0];
  if (!issue) {
    throw new Error('invalid game data: unknown validation error');
  }

  const [fileKey, ...rest] = issue.path;
  const fileLabel = typeof fileKey === 'string' ? `${fileKey}.json` : 'game data';
  const restPath = formatPath(rest as (string | number)[]);
  const location = restPath ? `${restPath}: ` : '';
  throw new Error(`${fileLabel}: ${location}${issue.message}`);
}
