// Which HUD action buttons are enabled/shown (task 09 req. 4, task 10 req. 6, task 14 req. 5).
// React-free so it's unit-testable.
import { canReplay, isPlaybackActive, type AppState } from '../state/store';

export interface HudButtons {
  endTurn: boolean;
  undo: boolean;
  replay: boolean;
  /** ⌂ Home: shown in every idle phase, hidden only during playback so a tap can't jump away from
   * an animation still in flight (task 14 req. 5). The HUD hides it in place (`visibility:
   * hidden`, disabled) so the row never shifts.
   *
   * It used to be hidden in `waveCleared` too, on the assumption that task 16's overlay would be
   * up and offering its own ▶. Task 16 isn't built yet, and nothing else in `/game` dispatches
   * `nextWave` — so hiding Home stranded the player on a cleared wave with no live button and no
   * robots left to touch. Home stays available; task 16 may revisit this once its overlay exists. */
  home: boolean;
}

export function hudButtons(state: Pick<AppState, 'run' | 'playback' | 'lastTurn'>): HudButtons {
  const { run } = state;
  const idle = !isPlaybackActive(state);
  const planning = run !== null && run.phase === 'planning' && idle;
  return {
    endTurn: planning,
    undo: planning && run.undo.length > 0,
    replay: canReplay(state),
    home: idle,
  };
}
