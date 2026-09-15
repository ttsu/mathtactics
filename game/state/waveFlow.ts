// The M2 run's between-wave and end-of-run flow (task 16): when the wave-cleared overlay shows,
// which reward tiles it pops in, and how many waves a run has. Framework-free, mirroring
// `levelFlow.ts`'s pattern for the M1 puzzle sequence. Win/lose screens read `run` directly
// (`exactKills`, `waveIndex`) — nothing here is specific to them beyond `waveCount`.

import type { StoreApi } from 'zustand/vanilla';
import type { RunState, TileId } from '../../sim/core/types';
import type { GameData } from '../../sim/data/schemas';
import { isPlaybackActive, type AppState, type AppStore } from './store';

/** The number of waves a run has (GDD §10.1: 10 in v1, 3 during M2) — shipped `waves.json` order,
 * same source `nextWave`/`resolveTurn` use to decide the last wave. */
export function waveCount(data: Pick<GameData, 'waves'>): number {
  return data.waves.waves.length;
}

/** The wave-cleared overlay shows once a non-final wave clears — reward tiles already granted to
 * the tray (task 13) — and its playback has finished, so the last kill's beat always plays first
 * (same rule as `showLevelCleared`, task 11). */
export function showWaveCleared(state: Pick<AppState, 'run' | 'playback'>): boolean {
  return (
    state.run !== null &&
    state.run.mode === 'run' &&
    state.run.phase === 'waveCleared' &&
    !isPlaybackActive(state)
  );
}

/** A single stable empty-array reference for `waveRewardTiles`' "nothing granted" case. Reusing
 * `useAppStore` as a Zustand selector requires a referentially stable result when nothing has
 * changed — a fresh `[]` literal on every call makes `useSyncExternalStore` see a "change" on
 * every render and loop forever (React error #185, caught in this task's manual testing). */
const NO_REWARDS: { pieceId: string; tileId: TileId }[] = [];

/** The tiles granted by the wave that just cleared, in listed order — read from the resolved
 * turn's `TilesGranted` event (task 13), which is saved with the run so a resumed overlay
 * (task 14) still shows them. `[]` when there is none (no run, or an empty reward). */
export function waveRewardTiles(run: RunState | null): { pieceId: string; tileId: TileId }[] {
  if (run === null) return NO_REWARDS;
  const granted = run.lastTurnEvents.find(
    (event): event is Extract<typeof event, { type: 'TilesGranted' }> =>
      event.type === 'TilesGranted',
  );
  return granted?.tiles ?? NO_REWARDS;
}

/** ▶ on the wave-cleared overlay: starts the next wave through the normal dispatch path, so its
 * spawn events play back like any other resolution. Ignored unless a wave is actually cleared, so
 * a double tap can't start two waves (`nextWave` itself would also refuse with `wrong_phase`, but
 * the UI doesn't rely on that — task 16 req. 1). */
export function continueToNextWave(store: StoreApi<AppStore>): void {
  const { run } = store.getState();
  if (run === null || run.phase !== 'waveCleared') return;
  store.getState().dispatch({ type: 'nextWave' });
}
