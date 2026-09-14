// @ts-check
import { builtinModules } from 'node:module';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * Layer boundaries (TECHNICAL_REFERENCE.md §2):
 *
 *   /sim          -> /sim, zod, yaml (scenario parser only)
 *   /game/state   -> /sim, zustand/vanilla
 *   /game/board   -> /sim, /game/state, phaser
 *   /game/ui      -> /sim, /game/state, react*
 *
 * None of the above may import phaser/react into /sim, and /sim/state, /game/board and
 * /game/ui must not cross-import each other's presentation framework or UI code.
 */

/** Shared React-entry-point ban list (react, react-dom, react-dom/client, react/jsx-runtime),
 * parameterized by the layer's own message — was duplicated 3× (sim/state/board). */
function reactImportBans(message) {
  return [
    { name: 'react', message },
    { name: 'react-dom', message },
    { name: 'react-dom/client', message },
    { name: 'react/jsx-runtime', message },
  ];
}

// Every Node built-in module, bare and `node:`-prefixed, plus their subpaths (e.g. `fs/promises`,
// `node:fs/promises`) — built from Node's own module registry instead of a hand-maintained list
// that can silently miss an entry (e.g. `fs/promises`).
const NODE_BUILTIN_PATTERNS = builtinModules.flatMap((name) => [
  name,
  `node:${name}`,
  `${name}/*`,
  `node:${name}/*`,
]);

const simRestrictedImports = {
  paths: [
    { name: 'phaser', message: '/sim must have no rendering dependency (CLAUDE.md rule 1).' },
    ...reactImportBans('/sim must have no rendering dependency (CLAUDE.md rule 1).'),
    { name: 'yaml', message: "'yaml' may only be imported within /sim/scenario (TR §2)." },
  ],
  patterns: [
    {
      group: NODE_BUILTIN_PATTERNS,
      message: '/sim must not import Node built-ins (TR §2).',
    },
    {
      // Safety net for any node: import not covered above (e.g. a future/experimental builtin).
      group: ['node:*'],
      message: '/sim must not import Node built-ins (TR §2).',
    },
    {
      group: ['**/game/**'],
      message: '/sim must not import from /game (TR §2).',
    },
  ],
};

const simScenarioRestrictedImports = {
  ...simRestrictedImports,
  paths: simRestrictedImports.paths.filter((entry) => entry.name !== 'yaml'),
};

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-subpath-test/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.playwright-browsers/**',
      '.superpowers/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    // Baseline environment for browser-facing app code.
    files: ['game/**/*.ts', 'game/**/*.tsx'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Node-context tooling code.
    files: [
      'scripts/**/*.ts',
      'e2e/**/*.ts',
      'tests/**/*.ts',
      'vite.config.ts',
      'playwright.config.ts',
      'eslint.config.js',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // /sim: pure simulation, no renderer/DOM/framework/Node/nondeterminism imports.
    files: ['sim/**/*.ts'],
    ignores: ['sim/scenario/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', simRestrictedImports],
    },
  },
  {
    // /sim/scenario is the one place `yaml` may be imported.
    files: ['sim/scenario/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', simScenarioRestrictedImports],
    },
  },
  {
    // /sim: ban nondeterminism and other I/O/ambient-state escape hatches (CLAUDE.md rule 1,
    // TR §2). All of these typecheck fine (ambient Node/DOM-ish globals) so lint is the only
    // thing that catches them.
    files: ['sim/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: '/sim must not use Math.random; use /sim/core/rng.ts instead.',
        },
        {
          object: 'Date',
          property: 'now',
          message: '/sim must not use Date.now.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'performance', message: '/sim must not use performance.' },
        { name: 'setTimeout', message: '/sim must not use setTimeout.' },
        { name: 'setInterval', message: '/sim must not use setInterval.' },
        { name: 'crypto', message: '/sim must not use crypto; use /sim/core/rng.ts instead.' },
        { name: 'process', message: '/sim must not use process (TR §2).' },
        { name: 'fetch', message: '/sim must not use fetch — /sim performs no I/O (TR §2).' },
        { name: 'queueMicrotask', message: '/sim must not use queueMicrotask.' },
        { name: 'setImmediate', message: '/sim must not use setImmediate.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: '/sim must not use `new Date` (nondeterminism, CLAUDE.md rule 1).',
        },
      ],
    },
  },
  {
    // /game/state: framework-free store; no Phaser, no React, and it may only reach into /sim
    // and `zustand/vanilla` — never the React `zustand` entry, and never /game/board or
    // /game/ui (TR §2).
    files: ['game/state/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'phaser', message: '/game/state must not import phaser (TR §2).' },
            ...reactImportBans('/game/state must not import react (TR §2).'),
            {
              name: 'zustand',
              message:
                "/game/state may only import 'zustand/vanilla', not the React entry 'zustand' (TR §2).",
            },
          ],
          patterns: [
            {
              group: [
                '**/game/board/**',
                '**/game/ui/**',
                '../board',
                '../board/*',
                '../ui',
                '../ui/*',
              ],
              message: '/game/state must not import /game/board or /game/ui (TR §2).',
            },
          ],
        },
      ],
    },
  },
  {
    // /game/board: Phaser only, never React or /game/ui.
    files: ['game/board/**/*.ts', 'game/board/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...reactImportBans('/game/board must not import react (TR §2).')],
          patterns: [
            {
              group: ['**/game/ui/**', '**/ui/**', '**/ui'],
              message: '/game/board must not import /game/ui (TR §2).',
            },
          ],
        },
      ],
    },
  },
  {
    // /game/ui: React only, never Phaser or /game/board.
    files: ['game/ui/**/*.ts', 'game/ui/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: '/game/ui must not import phaser (TR §2).' }],
          patterns: [
            {
              group: ['**/game/board/**', '**/board/**', '**/board'],
              message: '/game/ui must not import /game/board (TR §2).',
            },
          ],
        },
      ],
    },
  },
);
