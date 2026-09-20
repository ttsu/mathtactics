// Settings (task 24 + 29 + 31): planning-hints toggle (off by default), Easy/Normal/Hard
// default, and Sound on/off (default on). Icon-led, no sentences. Difficulty writes the next
// New Game highlight only — it never mutates an in-progress run.
import type { CSSProperties } from 'react';
import type { DifficultyId } from '../../sim/core/types';
import { playCue, playUiTap } from '../state/audio';
import { HintsIcon, PlayIcon, SpeakerIcon, StarIcon } from './icons';
import { SecretLongPress } from './debug';
import { useAppStore, useAppStoreApi } from './StoreContext';

export function SettingsScreen() {
  const store = useAppStoreApi();
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);
  const hints = useAppStore((state) => state.settings.hints);
  const sound = useAppStore((state) => state.settings.sound);
  const difficulty = useAppStore((state) => state.settings.difficulty);
  const modes = useAppStore((state) => state.data.difficulty.modes);

  function toggleHints() {
    playUiTap();
    store.getState().setSettings({ hints: !hints });
  }

  function toggleSound() {
    if (sound) {
      playUiTap();
      store.getState().setSettings({ sound: false });
      return;
    }
    store.getState().setSettings({ sound: true });
    playCue('preview');
  }

  return (
    <div
      className="screen"
      data-testid="settings"
      style={{ '--pop-in-ms': `${popInMs}ms` } as CSSProperties}
    >
      <div className="settings-toggles">
        <button
          type="button"
          className={`small-button pop-in${hints ? ' is-pressed' : ''}`}
          data-testid="settings-hints"
          aria-label="Hints"
          aria-pressed={hints}
          onClick={toggleHints}
        >
          <HintsIcon size={56} />
          <span className="button-label button-label-small">Hints</span>
        </button>
        <button
          type="button"
          className={`small-button pop-in${sound ? ' is-pressed' : ''}`}
          data-testid="settings-sound"
          aria-label="Sound"
          aria-pressed={sound}
          onClick={toggleSound}
        >
          <SpeakerIcon size={56} />
          <span className="button-label button-label-small">Sound</span>
        </button>
      </div>
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
              onClick={() => {
                playUiTap();
                store.getState().setSettings({ difficulty: id });
              }}
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
          onClick={() => {
            playUiTap();
            store.getState().setScreen('menu');
          }}
        >
          <PlayIcon size={96} />
          <span className="button-label">Home</span>
        </button>
      </SecretLongPress>
    </div>
  );
}
