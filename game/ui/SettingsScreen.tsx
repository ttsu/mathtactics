// Settings (task 24, GDD §11.8 / §18.2): planning-hints toggle, off by default. Icon-led, no
// sentences, no Sound row (that waits for M5 audio). `setSettings` already persists.
import type { CSSProperties } from 'react';
import { HintsIcon, PlayIcon } from './icons';
import { SecretLongPress } from './debug';
import { useAppStore, useAppStoreApi } from './StoreContext';

export function SettingsScreen() {
  const store = useAppStoreApi();
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);
  const hints = useAppStore((state) => state.settings.hints);

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
