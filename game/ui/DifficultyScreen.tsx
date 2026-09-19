// New Game difficulty picker (GDD §10.7, task 29). Three equally large star buttons; last pick
// is pressed. Tapping a star writes the Settings default and starts that run. Home cancels.
import type { CSSProperties } from 'react';
import type { DifficultyId } from '../../sim/core/types';
import { startNewRun } from '../state/runFlow';
import { PlayIcon, StarIcon } from './icons';
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
      <button
        type="button"
        className="big-button pop-in"
        data-testid="difficulty-home"
        aria-label="Home"
        onClick={() => store.getState().setScreen('menu')}
      >
        <PlayIcon size={96} />
        <span className="button-label">Home</span>
      </button>
    </div>
  );
}
