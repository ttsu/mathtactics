// @ts-check
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

const NODE_BUILTIN_NAMES = [
  'fs',
  'path',
  'os',
  'child_process',
  'crypto',
  'http',
  'https',
  'net',
  'tls',
  'stream',
  'util',
  'url',
  'querystring',
  'zlib',
  'events',
  'buffer',
  'assert',
  'timers',
  'dns',
  'readline',
  'cluster',
  'worker_threads',
  'process',
];

const simRestrictedImports = {
  paths: [
    { name: 'phaser', message: '/sim must have no rendering dependency (CLAUDE.md rule 1).' },
    { name: 'react', message: '/sim must have no rendering dependency (CLAUDE.md rule 1).' },
    {
      name: 'react-dom',
      message: '/sim must have no rendering dependency (CLAUDE.md rule 1).',
    },
    {
      name: 'react-dom/client',
      message: '/sim must have no rendering dependency (CLAUDE.md rule 1).',
    },
    {
      name: 'react/jsx-runtime',
      message: '/sim must have no rendering dependency (CLAUDE.md rule 1).',
    },
    { name: 'yaml', message: "'yaml' may only be imported within /sim/scenario (TR §2)." },
    ...NODE_BUILTIN_NAMES.map((name) => ({
      name,
      message: '/sim must not import Node built-ins (TR §2).',
    })),
  ],
  patterns: [
    {
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
    // /sim: ban nondeterminism (CLAUDE.md rule 1, TR §2).
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
      ],
    },
  },
  {
    // /game/state: framework-free store; no Phaser, no React.
    files: ['game/state/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'phaser', message: '/game/state must not import phaser (TR §2).' },
            { name: 'react', message: '/game/state must not import react (TR §2).' },
            { name: 'react-dom', message: '/game/state must not import react-dom (TR §2).' },
            {
              name: 'react-dom/client',
              message: '/game/state must not import react-dom (TR §2).',
            },
            {
              name: 'react/jsx-runtime',
              message: '/game/state must not import react (TR §2).',
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
          paths: [
            { name: 'react', message: '/game/board must not import react (TR §2).' },
            { name: 'react-dom', message: '/game/board must not import react-dom (TR §2).' },
            {
              name: 'react-dom/client',
              message: '/game/board must not import react-dom (TR §2).',
            },
            {
              name: 'react/jsx-runtime',
              message: '/game/board must not import react (TR §2).',
            },
          ],
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
