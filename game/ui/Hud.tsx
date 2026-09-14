// HUD placeholder (task 03 req. 5). Values are dummies until task 05 wires the store.
import { HUD_BAR, MIN_TOUCH_TARGET } from '../state/designSpace';

export function Hud() {
  return (
    <div
      className="hud-bar"
      data-testid="hud-bar"
      style={{ left: HUD_BAR.x, top: HUD_BAR.y, width: HUD_BAR.width, height: HUD_BAR.height }}
    >
      <span className="hud-stat">Wave 1</span>
      <span className="hud-stat">♥ 100</span>
      <span className="hud-stat">🪙 0</span>
      <button
        type="button"
        className="hud-button"
        data-testid="end-turn"
        style={{ minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET }}
        onClick={() => {
          // No-op until task 09 dispatches endTurn.
        }}
      >
        End Turn
      </button>
    </div>
  );
}
