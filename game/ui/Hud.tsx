// HUD (task 03 req. 5 placeholder, task 05 req. 6: reads coins/base HP from `display` via the
// store; task 09 req. 4: End Turn and Undo dispatch real commands).
import { HUD_BAR, MIN_TOUCH_TARGET } from '../state/designSpace';
import { hudButtons } from './hudButtons';
import { useAppStore } from './StoreContext';

const touchTarget = { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET };

export function Hud() {
  const display = useAppStore((state) => state.display);
  const canEndTurn = useAppStore((state) => hudButtons(state).endTurn);
  const canUndo = useAppStore((state) => hudButtons(state).undo);
  const dispatch = useAppStore((state) => state.dispatch);
  const finishPlayback = useAppStore((state) => state.finishPlayback);

  return (
    <div
      className="hud-bar"
      data-testid="hud-bar"
      style={{ left: HUD_BAR.x, top: HUD_BAR.y, width: HUD_BAR.width, height: HUD_BAR.height }}
    >
      <span className="hud-stat">Wave {display.waveIndex + 1}</span>
      <span className="hud-stat">♥ {display.baseHp}</span>
      <span className="hud-stat">🪙 {display.coins}</span>
      <div className="hud-actions">
        <button
          type="button"
          className="hud-button hud-button-undo"
          data-testid="undo"
          aria-label="Undo"
          style={touchTarget}
          disabled={!canUndo}
          onClick={() => dispatch({ type: 'undo' })}
        >
          ↶
        </button>
        <button
          type="button"
          className="hud-button"
          data-testid="end-turn"
          style={touchTarget}
          disabled={!canEndTurn}
          onClick={() => {
            const result = dispatch({ type: 'endTurn' });
            // TODO(task 10): remove once the playback Director drives finishPlayback
            if (result.ok) finishPlayback();
          }}
        >
          End Turn
        </button>
      </div>
    </div>
  );
}
