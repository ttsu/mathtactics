// Danger-lane derivation (task 15 req. 6, GDD §12.2 "Planning-phase cues"): a lane whose on-board
// robot sits on column 1 will detonate this turn unless it's killed first. Waiting robots
// (`col: null`) never count. Phaser-free so it's unit-testable in node, and re-derived from `run`
// on every call — presentation never caches a rule the sim didn't state.

import type { Lane } from '../../../sim/core/coords';
import { footprintLanes } from '../../../sim/core/footprint';
import type { RunState } from '../../../sim/core/types';

export function dangerLanes(run: RunState): Lane[] {
  const lanes = new Set<Lane>();
  for (const robot of run.board.robots) {
    if (robot.col !== 1) continue;
    for (const lane of footprintLanes(robot)) lanes.add(lane);
  }
  return [...lanes].sort((a, b) => a - b);
}
