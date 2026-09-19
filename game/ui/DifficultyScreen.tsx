// New Game difficulty picker (GDD §10.7, task 29). Three equally large star buttons; last pick
// is pressed. Tapping a star writes the Settings default and starts that run. A small Back at
// the top left cancels without starting.
import type { CSSProperties } from 'react';
import type { DifficultyId } from '../../sim/core/types';
import { MIN_TOUCH_TARGET } from '../state/designSpace';
import { startNewRun } from '../state/runFlow';
import { BackIcon, StarIcon } from './icons';
import { useAppStore, useAppStoreApi } from './StoreContext';

export function DifficultyScreen() {
  const store = useAppStoreApi();
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);
  const modes = useAppStore((state) => state.data.difficulty.modes);
  const selected = useAppStore((state) => state.settings.difficulty);

  function pick(id: DifficultyId) {
    store.getState().setSettings({ difficulty: id });
    startNewRun(store, id);
  }

  return (
    <div
      className="screen"
      data-testid="difficulty"
      style={{ '--pop-in-ms': `${popInMs}ms` } as CSSProperties}
    >
      <button
        type="button"
        className="difficulty-back pop-in"
        data-testid="difficulty-back"
        aria-label="Back"
        style={{ minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET }}
        onClick={() => store.getState().setScreen('menu')}
      >
        <BackIcon size={32} />
        <span className="button-label button-label-small">Back</span>
      </button>
      <div className="difficulty-row">
        {(['easy', 'normal', 'hard'] as const).map((id) => {
          const mode = modes[id];
          const pressed = selected === id;
          return (
            <button
              key={id}
              type="button"
              className={`big-button pop-in${pressed ? ' is-pressed' : ''}`}
              data-testid={`difficulty-${id}`}
              aria-label={mode.label}
              aria-pressed={pressed}
              onClick={() => pick(id)}
            >
              <span className="difficulty-stars" aria-hidden="true">
                {Array.from({ length: mode.stars }, (_, i) => (
                  <StarIcon key={i} size={36} />
                ))}
              </span>
              <span className="button-label">{mode.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
