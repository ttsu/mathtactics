// The M2/M3 run's between-wave flow (task 16, task 19): when the wave-cleared overlay shows,
// the wave-clear coin bonus it pops in, and how many waves a run has. Framework-free, mirroring
// `levelFlow.ts`. The overlay's ▶ opens the shop (`shopFlow.ts`); it no longer starts the next
// wave itself.

import type { RunState } from '../../sim/core/types';
import type { GameData } from '../../sim/data/schemas';
import { isPlaybackActive, type AppState } from './store';

/** The number of waves a run has (GDD §10.1: 10 in v1, 3 during M2) — shipped `waves.json` order,
 * same source `nextWave`/`resolveTurn` use to decide the last wave. */
export function waveCount(data: Pick<GameData, 'waves'>): number {
  return data.waves.waves.length;
}

/** The wave-cleared overlay shows once a non-final wave clears and its playback has finished, so
 * the last kill's beat always plays first (same rule as `showLevelCleared`, task 11 — which this
 * now matches exactly, `screen === 'game'` included: integration follow-up to task 16 req. 1, so
 * a resume flow that hasn't switched `screen` to `'game'` yet can't get a false positive from
 * this alone). `hudButtons.ts`'s ⌂ Home uses this same function to hide itself while the overlay
 * is up (task 14 req. 5). */
export function showWaveCleared(state: Pick<AppState, 'run' | 'playback' | 'screen'>): boolean {
  return (
    state.screen === 'game' &&
    state.run !== null &&
    state.run.mode === 'run' &&
    state.run.phase === 'waveCleared' &&
    !isPlaybackActive(state)
  );
}

/** The wave-cleared coin bonus from the last turn's `CoinsChanged { reason: 'waveCleared' }`
 * event, which is saved with the run so a resumed overlay still shows it. `0` when there is none
 * (no run, or no such event). */
export function waveClearCoins(run: RunState | null): number {
  if (run === null) return 0;
  const granted = run.lastTurnEvents.find(
    (event): event is Extract<typeof event, { type: 'CoinsChanged' }> =>
      event.type === 'CoinsChanged' && event.reason === 'waveCleared',
  );
  return granted?.delta ?? 0;
}
