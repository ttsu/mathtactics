import { beforeAll, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

// Proves the layer-boundary lint rules (TECHNICAL_REFERENCE.md §2, CLAUDE.md rule 1) actually
// fire, by linting fixture code strings against fake file paths in the relevant directories.
// This runs against the real eslint.config.js — no fixture files are written to disk.

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: process.cwd() });
});

async function lint(code: string, filePath: string): Promise<ESLint.LintResult> {
  const results = await eslint.lintText(code, { filePath });
  const result = results[0];
  if (!result) {
    throw new Error(`eslint produced no result for ${filePath}`);
  }
  return result;
}

function ruleIds(result: ESLint.LintResult): (string | null)[] {
  return result.messages.map((m) => m.ruleId);
}

describe('layer boundary lint rules', () => {
  it('flags importing phaser from /sim', async () => {
    const result = await lint("import Phaser from 'phaser';\nexport {};\n", 'sim/core/fixture.ts');
    expect(ruleIds(result)).toContain('no-restricted-imports');
  });

  it('flags importing react from /sim', async () => {
    const result = await lint("import React from 'react';\nexport {};\n", 'sim/core/fixture.ts');
    expect(ruleIds(result)).toContain('no-restricted-imports');
  });

  it('flags importing phaser from /game/ui', async () => {
    const result = await lint("import Phaser from 'phaser';\nexport {};\n", 'game/ui/fixture.ts');
    expect(ruleIds(result)).toContain('no-restricted-imports');
  });

  it('flags Math.random() in /sim', async () => {
    const result = await lint(
      'export function f(): number {\n  return Math.random();\n}\n',
      'sim/core/fixture.ts',
    );
    expect(ruleIds(result)).toContain('no-restricted-properties');
  });
});
