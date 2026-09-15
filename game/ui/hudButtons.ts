// Which HUD action buttons are enabled/shown (task 09 req. 4, task 10 req. 6, task 14 req. 5).
// React-free so it's unit-testable.
import { canReplay, isPlaybackActive, type AppState } from '../state/store';

export interface HudButtons {
  endTurn: boolean;
  undo: boolean;
  replay: boolean;
  /** ⌂ Home: hidden during playback and while the run-mode wave-cleared overlay is up — the one
   * moment, absent a shop, where a run is otherwise idle but not actionable (task 14 req. 5).
   * The HUD hides it in place (`visibility: hidden`, disabled) so the row never shifts. Task 16's
   * own `showWaveCleared` names the same condition for its overlay; kept local here rather than
   * shared, per the task boundary. */
  home: boolean;
}

export function hudButtons(state: Pick<AppState, 'run' | 'playback' | 'lastTurn'>): HudButtons {
  const { run } = state;
  const idle = !isPlaybackActive(state);
  const planning = run !== null && run.phase === 'planning' && idle;
  const waveClearedOverlayUp =
    run !== null && run.mode === 'run' && run.phase === 'waveCleared' && idle;
  return {
    endTurn: planning,
    undo: planning && run.undo.length > 0,
    replay: canReplay(state),
    home: idle && !waveClearedOverlayUp,
  };
}
