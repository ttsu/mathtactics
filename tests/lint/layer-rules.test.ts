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

  it('flags importing phaser from /game/state', async () => {
    const result = await lint(
      "import Phaser from 'phaser';\nexport const p = Phaser;\n",
      'game/state/fixture.ts',
    );
    expect(ruleIds(result)).toContain('no-restricted-imports');
  });

  it('flags importing react from /game/state', async () => {
    const result = await lint(
      "import React from 'react';\nexport const r = React;\n",
      'game/state/fixture.ts',
    );
    expect(ruleIds(result)).toContain('no-restricted-imports');
  });

  it('flags importing /game/board from /game/ui and /game/ui from /game/board', async () => {
    const uiResult = await lint(
      "import { GRID } from '../board/layout';\nexport const g = GRID;\n",
      'game/ui/fixture.ts',
    );
    expect(ruleIds(uiResult)).toContain('no-restricted-imports');
    const boardResult = await lint(
      "import { App } from '../ui/App';\nexport const a = App;\n",
      'game/board/fixture.ts',
    );
    expect(ruleIds(boardResult)).toContain('no-restricted-imports');
  });

  it('allows both /game/board and /game/ui to import shared design space from /game/state', async () => {
    for (const filePath of ['game/board/fixture.ts', 'game/ui/fixture.ts']) {
      const result = await lint(
        "import { HUD_BAR } from '../state/designSpace';\nexport const h = HUD_BAR;\n",
        filePath,
      );
      expect(ruleIds(result)).not.toContain('no-restricted-imports');
    }
  });

  it('flags Math.random() in /sim', async () => {
    const result = await lint(
      'export function f(): number {\n  return Math.random();\n}\n',
      'sim/core/fixture.ts',
    );
    expect(ruleIds(result)).toContain('no-restricted-properties');
  });

  it('flags crypto.randomUUID() in /sim', async () => {
    const result = await lint(
      'export function f(): string {\n  return crypto.randomUUID();\n}\n',
      'sim/core/fixture.ts',
    );
    expect(ruleIds(result)).toContain('no-restricted-globals');
  });

  it('flags new Date() in /sim', async () => {
    const result = await lint(
      'export function f(): Date {\n  return new Date();\n}\n',
      'sim/core/fixture.ts',
    );
    expect(ruleIds(result)).toContain('no-restricted-syntax');
  });

  it('flags process.env in /sim', async () => {
    const result = await lint(
      'export function f(): string | undefined {\n  return process.env.FOO;\n}\n',
      'sim/core/fixture.ts',
    );
    expect(ruleIds(result)).toContain('no-restricted-globals');
  });

  it('flags importing fs/promises in /sim', async () => {
    const result = await lint(
      "import { readFile } from 'fs/promises';\nexport { readFile };\n",
      'sim/core/fixture.ts',
    );
    expect(ruleIds(result)).toContain('no-restricted-imports');
  });

  it('flags importing node:fs/promises in /sim', async () => {
    const result = await lint(
      "import { readFile } from 'node:fs/promises';\nexport { readFile };\n",
      'sim/core/fixture.ts',
    );
    expect(ruleIds(result)).toContain('no-restricted-imports');
  });

  it('flags importing the zustand React entry from /game/state', async () => {
    const result = await lint(
      "import { create } from 'zustand';\nexport const useStore = create;\n",
      'game/state/fixture.ts',
    );
    expect(ruleIds(result)).toContain('no-restricted-imports');
  });

  it('allows importing zustand/vanilla from /game/state', async () => {
    const result = await lint(
      "import { createStore } from 'zustand/vanilla';\nexport const s = createStore(() => ({}));\n",
      'game/state/fixture.ts',
    );
    expect(ruleIds(result)).not.toContain('no-restricted-imports');
  });

  it('flags importing /game/board or /game/ui from /game/state', async () => {
    const boardResult = await lint(
      "import { GRID } from '../board/layout';\nexport const g = GRID;\n",
      'game/state/fixture.ts',
    );
    expect(ruleIds(boardResult)).toContain('no-restricted-imports');

    const uiResult = await lint(
      "import { App } from '../ui/App';\nexport const a = App;\n",
      'game/state/fixture.ts',
    );
    expect(ruleIds(uiResult)).toContain('no-restricted-imports');
  });
});
