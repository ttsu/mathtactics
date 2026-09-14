// HUD (task 03 req. 5 placeholder, task 05 req. 6: reads coins/base HP from `display` via the
// store). End Turn stays a no-op — dispatching a real `endTurn` command lands in task 06/09.
import { HUD_BAR, MIN_TOUCH_TARGET } from '../state/designSpace';
import { useAppStore } from './StoreContext';

export function Hud() {
  const display = useAppStore((state) => state.display);

  return (
    <div
      className="hud-bar"
      data-testid="hud-bar"
      style={{ left: HUD_BAR.x, top: HUD_BAR.y, width: HUD_BAR.width, height: HUD_BAR.height }}
    >
      <span className="hud-stat">Wave {display.waveIndex + 1}</span>
      <span className="hud-stat">♥ {display.baseHp}</span>
      <span className="hud-stat">🪙 {display.coins}</span>
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
