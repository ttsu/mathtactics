// The `difficulty.json` block (task 28) for hand-built fake `GameData` fixtures — one copy, so a
// new overlay field is added in one place (same pattern as `fakeShop`).

import type { DifficultyFile } from '../../sim/data/schemas';

const identityHp = {
  nonBoss: { mul: 100, min: 1, max: 99 },
  parity: { mul: 100, min: 1, max: 99 },
  boss: { mul: 100, min: 1, max: 1000 },
} as const;

export function fakeDifficulty(overrides: Partial<DifficultyFile> = {}): DifficultyFile {
  return {
    default: 'normal',
    modes: {
      easy: {
        label: 'Easy',
        stars: 1,
        hp: {
          nonBoss: { mul: 75, min: 1, max: 99 },
          parity: { mul: 65, min: 8, max: 99 },
          boss: { mul: 100, min: 1, max: 1000 },
        },
        countDelta: -1,
        minCount: 2,
        maxCount: 5,
        dropTemplates: [],
      },
      normal: {
        label: 'Normal',
        stars: 2,
        hp: identityHp,
        countDelta: 0,
        minCount: 1,
        maxCount: 5,
        dropTemplates: [],
      },
      hard: {
        label: 'Hard',
        stars: 3,
        hp: identityHp,
        countDelta: 1,
        minCount: 1,
        maxCount: 5,
        dropTemplates: ['basic'],
      },
    },
    ...overrides,
  };
}
