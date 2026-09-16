// `openShop` (GDD §8.3/§8.5, TR §5): waveCleared → shop. Rolls this visit's offers once from
// the `shop` stream and stores them on the run, so a reload shows the same cards (and the same
// already-bought slots). Emits no events — there is nothing for the board to play.

import { rollShop } from '../shop/rollShop';
import type { RunState } from '../core/types';
import type { GameData } from '../data/schemas';
import { fail, ok, type CommandResult } from './types';

export function openShop(state: RunState, data: GameData): CommandResult {
  if (state.phase !== 'waveCleared') return fail('wrong_phase');

  // `afterWave` is 1-based: the wave just cleared (`= waveIndex + 1`), keyed to `shop.json`.
  // Every other wave reference in the codebase is 0-based.
  const afterWave = state.waveIndex + 1;
  const rolled = rollShop(afterWave, state, data);

  return ok({
    ...state,
    phase: 'shop',
    shop: { afterWave, offers: rolled.offers },
    rng: { ...state.rng, shop: rolled.rng },
  });
}
