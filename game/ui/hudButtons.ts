// Which HUD action buttons are enabled (task 09 req. 4). React-free so it's unit-testable.
import type { AppState } from '../state/store';

export interface HudButtons {
  endTurn: boolean;
  undo: boolean;
}

export function hudButtons(state: Pick<AppState, 'run' | 'playback'>): HudButtons {
  const { run, playback } = state;
  const planning = run !== null && run.phase === 'planning' && playback.status !== 'playing';
  return {
    endTurn: planning,
    undo: planning && run.undo.length > 0,
  };
}
