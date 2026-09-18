import { useState } from 'react';
import { MIN_TOUCH_TARGET } from '../../state/designSpace';
import { useDebugUi } from './DebugContext';
import { DEBUG_PANELS } from './panels';
import './debug.css';

async function requestShakePermission(): Promise<boolean> {
  const DeviceMotion = window.DeviceMotionEvent as
    (typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> }) | undefined;
  if (DeviceMotion && typeof DeviceMotion.requestPermission === 'function') {
    try {
      const result = await DeviceMotion.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  return typeof window.DeviceMotionEvent !== 'undefined';
}

export function DebugMenu() {
  const debug = useDebugUi();
  const [panelId, setPanelId] = useState(DEBUG_PANELS[0]?.id ?? 'jump');
  const active = DEBUG_PANELS.find((panel) => panel.id === panelId) ?? DEBUG_PANELS[0];
  if (!active) return null;
  const Panel = active.Panel;

  return (
    <div className="debug-wash" data-testid="debug-menu">
      <div className="debug-card">
        <header className="debug-header">
          <div>
            <h2 className="debug-title">Debug</h2>
            <p className="debug-lede">Parent tools. Hidden from the kid UI.</p>
          </div>
          <button
            type="button"
            className="debug-close"
            data-testid="debug-close"
            aria-label="Close"
            style={{ minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET }}
            onClick={() => debug.setOpen(false)}
          >
            ×
          </button>
        </header>
        <nav className="debug-tabs" aria-label="Debug sections">
          {DEBUG_PANELS.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`debug-tab${panel.id === active.id ? ' is-selected' : ''}`}
              data-testid={`debug-tab-${panel.id}`}
              aria-pressed={panel.id === active.id}
              onClick={() => setPanelId(panel.id)}
            >
              {panel.title}
            </button>
          ))}
        </nav>
        <div className="debug-body">
          <Panel />
        </div>
        <label className="debug-shake">
          <input
            type="checkbox"
            data-testid="debug-shake"
            checked={debug.shakeEnabled}
            onChange={async (event) => {
              if (!event.target.checked) {
                debug.setShakeEnabled(false);
                return;
              }
              const allowed = await requestShakePermission();
              debug.setShakeEnabled(allowed);
            }}
          />
          Open by shaking
        </label>
      </div>
    </div>
  );
}
