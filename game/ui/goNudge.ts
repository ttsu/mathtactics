// Idle nudge for the HUD fire control (▶ Go). React-free so the layout fingerprint and the
// CSS class/key that restart the wiggle are unit-testable. Presentation only: never changes
// an outcome. Timing and amplitude live in `presentation.json` `hud`.

import type { RunState } from '../../sim/core/types';

/** Fingerprint of the planning layout: tiles on the board, tray order, and cannons.
 * A change means the player did something; the Go wiggle delay restarts. Robots, HP, coins
 * and phase are ignored — those change without the player moving a piece. */
export function planningLayoutKey(run: RunState | null): string {
  if (run === null) return '';
  return JSON.stringify({
    cells: run.board.cells,
    tray: run.tray,
    cannons: run.board.cannons,
  });
}

/** React `key` for the Go button. Remounting restarts the CSS animation-delay, so a new
 * planning phase or a layout change begins a fresh idle wait. */
export function goNudgeAnimationKey(canEndTurn: boolean, layoutKey: string): string {
  return canEndTurn ? `planning:${layoutKey}` : 'idle';
}

export function goButtonClassName(canEndTurn: boolean): string {
  return canEndTurn ? 'hud-button hud-button-go is-planning' : 'hud-button hud-button-go';
}
