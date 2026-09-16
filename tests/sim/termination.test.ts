// Termination property (task 13 requirement): a run driven only by `endTurn` (and `nextWave`
// once `waveCleared`) always reaches `won` or `lost` within a bound, for many seeds, using the
// real shipped `waves.json`. No tile placement ever happens — this exercises ADVANCE, DETONATE,
// END CHECK, fast-forward, and SPAWN purely from the turn loop itself.

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../sim/commands/applyCommand';
import { parseGameData } from '../../sim/data/load';
import type { Phase } from '../../sim/core/types';
import { loadRawGameData } from '../helpers/loadDataFiles';

const data = parseGameData(loadRawGameData());

const MAX_END_TURNS = 200;

function driveToEnd(seed: string): { phase: Phase; endTurns: number } {
  const started = applyCommand(null, { type: 'newRun', seed }, data);
  if (!started.ok) throw new Error(`newRun("${seed}") failed: ${started.error}`);
  let state = started.state;
  let endTurns = 0;

  while (state.phase !== 'won' && state.phase !== 'lost') {
    if (endTurns >= MAX_END_TURNS) break;

    const cmd =
      state.phase === 'waveCleared' ? { type: 'nextWave' as const } : { type: 'endTurn' as const };
    const result = applyCommand(state, cmd, data);
    if (!result.ok) {
      throw new Error(
        `seed "${seed}": ${cmd.type} failed at turn ${endTurns} with "${result.error}"`,
      );
    }
    state = result.state;
    if (cmd.type === 'endTurn') endTurns++;
  }

  return { phase: state.phase, endTurns };
}

describe('termination property: newRun + endTurn/nextWave always reaches won or lost', () => {
  for (let seed = 1; seed <= 50; seed++) {
    it(`seed ${seed}`, () => {
      const { phase, endTurns } = driveToEnd(String(seed));
      expect(['won', 'lost']).toContain(phase);
      expect(endTurns).toBeLessThan(MAX_END_TURNS);
    });
  }
});
