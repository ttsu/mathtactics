// Which HUD action buttons are enabled/shown (task 09 req. 4, task 10 req. 6, task 14 req. 5).
// React-free so it's unit-testable.
import { canReplay, isPlaybackActive, type AppState } from '../state/store';
import { showWaveCleared } from '../state/waveFlow';

export interface HudButtons {
  endTurn: boolean;
  undo: boolean;
  replay: boolean;
  /** ⌂ Home: hidden during playback — so a tap can't jump away from an animation still in flight
   * — and while the run-mode wave-cleared overlay is up, the one moment, absent a shop, where a
   * run is otherwise idle but not actionable (task 14 req. 5). The HUD hides it in place
   * (`visibility: hidden`, disabled) so the row never shifts.
   *
   * Task 14 shipped with Home visible in `waveCleared` on purpose: the overlay didn't exist yet
   * and nothing else in `/game` dispatched `nextWave`, so hiding Home stranded the player on a
   * cleared wave. Task 16's overlay now offers its own ▶, so the original condition is restored,
   * delegating to `showWaveCleared` so it's defined in exactly one place. */
  home: boolean;
}

export function hudButtons(
  state: Pick<AppState, 'run' | 'playback' | 'lastTurn' | 'screen'>,
): HudButtons {
  const { run } = state;
  const idle = !isPlaybackActive(state);
  const planning = run !== null && run.phase === 'planning' && idle;
  return {
    endTurn: planning,
    undo: planning && run.undo.length > 0,
    replay: canReplay(state),
    home: idle && !showWaveCleared(state),
  };
}
