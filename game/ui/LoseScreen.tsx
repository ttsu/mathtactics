// Lose screen (task 16 req. 3): cheerful, no shaming — a big smile and a few robots doing a silly
// dance, never a red X or "game over" imagery (GDD §11.4, §10.6). Wave dots show how far the run
// got (the current wave is not marked cleared — it's the one that beat the player), the
// exact-kill row still celebrates the run's exact kills, and the only button is a big ▶ back to
// the menu (GDD §10.1: loss returns to the menu, no other options).
import type { CSSProperties } from 'react';
import { waveCount } from '../state/waveFlow';
import { DancingRobotIcon, PlayIcon, SmileIcon } from './icons';
import { SecretTap } from './debug';
import { ExactKillRow } from './ExactKillRow';
import { LevelDots } from './LevelDots';
import { useAppStore, useAppStoreApi } from './StoreContext';

const ROBOT_COLORS = ['#4f86c6', '#3f9e8f', '#ff8c42'];

export function LoseScreen() {
  const store = useAppStoreApi();
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);
  const danceMs = useAppStore((state) => state.data.presentation.screens.danceMs);
  const danceStaggerMs = useAppStore((state) => state.data.presentation.screens.danceStaggerMs);
  const count = useAppStore((state) => waveCount(state.data));
  const waveIndex = useAppStore((state) => state.run?.waveIndex ?? 0);
  const exactKills = useAppStore((state) => state.run?.exactKills ?? 0);

  return (
    <div
      className="screen"
      data-testid="lost"
      style={{ '--pop-in-ms': `${popInMs}ms` } as CSSProperties}
    >
      <SecretTap testId="lost-cheer">
        <div className="lose-cheer pop-in" aria-hidden="true">
          <SmileIcon size={200} />
          <div className="lose-robots">
            {ROBOT_COLORS.map((color, i) => (
              <span
                key={color}
                className="dancing-robot"
                style={
                  {
                    color,
                    '--dance-ms': `${danceMs}ms`,
                    animationDelay: `${i * danceStaggerMs}ms`,
                  } as CSSProperties
                }
              >
                <DancingRobotIcon size={80} />
              </span>
            ))}
          </div>
        </div>
      </SecretTap>
      <LevelDots index={waveIndex} count={count} size="large" />
      <ExactKillRow count={exactKills} />
      <button
        type="button"
        className="big-button pop-in"
        data-testid="lost-menu"
        aria-label="Menu"
        onClick={() => store.getState().setScreen('menu')}
      >
        <PlayIcon size={96} />
      </button>
    </div>
  );
}
