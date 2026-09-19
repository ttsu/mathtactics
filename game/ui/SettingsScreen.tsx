// Settings (task 24 + 29): planning-hints toggle (off by default) and Easy/Normal/Hard default.
// Icon-led, no sentences, no Sound row (that waits for M5 audio). Difficulty writes the next
// New Game highlight only — it never mutates an in-progress run.
import type { CSSProperties } from 'react';
import type { DifficultyId } from '../../sim/core/types';
import { HintsIcon, PlayIcon, StarIcon } from './icons';
import { SecretLongPress } from './debug';
import { useAppStore, useAppStoreApi } from './StoreContext';

export function SettingsScreen() {
  const store = useAppStoreApi();
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);
  const hints = useAppStore((state) => state.settings.hints);
  const difficulty = useAppStore((state) => state.settings.difficulty);
  const modes = useAppStore((state) => state.data.difficulty.modes);

  return (
    <div
      className="screen"
      data-testid="settings"
      style={{ '--pop-in-ms': `${popInMs}ms` } as CSSProperties}
    >
      <button
        type="button"
        className={`small-button pop-in${hints ? ' is-pressed' : ''}`}
        data-testid="settings-hints"
        aria-label="Hints"
        aria-pressed={hints}
        onClick={() => store.getState().setSettings({ hints: !hints })}
      >
        <HintsIcon size={56} />
        <span className="button-label button-label-small">Hints</span>
      </button>
      <div className="difficulty-row">
        {(['easy', 'normal', 'hard'] as const).map((id: DifficultyId) => {
          const mode = modes[id];
          const pressed = difficulty === id;
          return (
            <button
              key={id}
              type="button"
              className={`small-button pop-in${pressed ? ' is-pressed' : ''}`}
              data-testid={`settings-difficulty-${id}`}
              aria-label={mode.label}
              aria-pressed={pressed}
              onClick={() => store.getState().setSettings({ difficulty: id })}
            >
              <span className="difficulty-stars" aria-hidden="true">
                {Array.from({ length: mode.stars }, (_, i) => (
                  <StarIcon key={i} size={22} />
                ))}
              </span>
              <span className="button-label button-label-small">{mode.label}</span>
            </button>
          );
        })}
      </div>
      <SecretLongPress>
        <button
          type="button"
          className="big-button pop-in"
          data-testid="settings-home"
          aria-label="Home"
          onClick={() => store.getState().setScreen('menu')}
        >
          <PlayIcon size={96} />
          <span className="button-label">Home</span>
        </button>
      </SecretLongPress>
    </div>
  );
}
