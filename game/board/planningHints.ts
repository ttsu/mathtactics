// Planning-hint draw list (task 24, GDD §5.7): the Phaser-free seam between `laneHintValues`
// and the board. Returns the numerals the board should draw right now — empty when hints are
// off, playback is running, or the run is not in planning. BoardRenderer.syncHints consumes
// this list; unit tests assert on it so the drawer is not called with marks when the flag is off.

import { lanes, type Col, type Lane } from '../../sim/core/coords';
import { laneHintValues } from '../../sim/core/hints';
import type { RunState } from '../../sim/core/types';
import type { GameData } from '../../sim/data/schemas';

export interface PlanningHintMark {
  lane: Lane;
  col: Col;
  value: number;
}

export function planningHintMarks(
  run: RunState | null,
  data: GameData,
  hintsEnabled: boolean,
  playbackIdle: boolean,
): PlanningHintMark[] {
  if (!hintsEnabled || !playbackIdle || run === null || run.phase !== 'planning') return [];
  const marks: PlanningHintMark[] = [];
  for (const lane of lanes()) {
    for (const hint of laneHintValues(run, lane, data)) {
      marks.push({ lane, col: hint.col, value: hint.value });
    }
  }
  return marks;
}
