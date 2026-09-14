#!/usr/bin/env -S npx tsx
// Fails if the test handle marker (`__GAME__`, see CLAUDE.md Core Rule 7 / task 05) appears
// anywhere in a production build. Run after a *plain* build (no VITE_TEST_HANDLE) — CI runs
// this between `npm run build` and `npm run test:e2e` (whose webServer rebuilds dist WITH the
// handle), and the Pages deploy workflow runs it after its own handle-free build.
//
// Usage: npm run check:no-test-handle [dir]   (defaults to "dist")
// Run via tsx, same as scripts/sim.ts (see that file's header for why).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const MARKER = '__GAME__';
const dir = process.argv[2] ?? 'dist';

function walk(path: string): string[] {
  const entries = readdirSync(path);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(path, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
    } else if (stat.isFile()) {
      files.push(full);
    }
  }
  return files;
}

let root;
try {
  root = statSync(dir);
} catch {
  console.error(`check-no-test-handle: "${dir}" does not exist — build first.`);
  process.exit(1);
}
if (!root.isDirectory()) {
  console.error(`check-no-test-handle: "${dir}" is not a directory.`);
  process.exit(1);
}

const hits: { file: string; line: number }[] = [];
for (const file of walk(dir)) {
  let content: string;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    // Binary asset (image, font, wasm, ...) — not a source of the marker; skip.
    continue;
  }
  if (content.includes(MARKER)) {
    const lineIndex = content.slice(0, content.indexOf(MARKER)).split('\n').length;
    hits.push({ file: relative(process.cwd(), file), line: lineIndex });
  }
}

if (hits.length > 0) {
  console.error(`check-no-test-handle: found "${MARKER}" in ${hits.length} location(s):`);
  for (const hit of hits) {
    console.error(`  ${hit.file}:${hit.line}`);
  }
  console.error(
    `\n"${MARKER}" must not appear in a production build (CLAUDE.md Core Rule 7). ` +
      'Make sure this build ran without VITE_TEST_HANDLE set.',
  );
  process.exit(1);
}

console.log(`check-no-test-handle: OK — no "${MARKER}" found in "${dir}".`);
