// Wave-cleared overlay (task 16, task 19): a big star, the wave dots with the cleared wave
// filled, the wallet with the wave-clear bonus popping in, and a big ▶ that opens the shop
// (GDD §10.5). Reward tiles are gone — the shop is the only way tiles enter a run.
import type { CSSProperties } from 'react';
import { playUiTap } from '../state/audio';
import { openShopScreen } from '../state/shopFlow';
import { showWaveCleared, waveClearCoins, waveCount } from '../state/waveFlow';
import { CoinStack } from './CoinStack';
import { PlayIcon, StarIcon } from './icons';
import { SecretTap } from './debug';
import { LevelDots } from './LevelDots';
import { useAppStore, useAppStoreApi } from './StoreContext';

export function WaveClearedOverlay() {
  const store = useAppStoreApi();
  const visible = useAppStore(showWaveCleared);
  const waveIndex = useAppStore((state) => state.run?.waveIndex ?? 0);
  const count = useAppStore((state) => waveCount(state.data));
  const coins = useAppStore((state) => state.display.coins);
  const bonus = useAppStore((state) => waveClearCoins(state.run));
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);
  const rewardStaggerMs = useAppStore((state) => state.data.presentation.screens.rewardStaggerMs);

  if (!visible) return null;

  return (
    <div
      className="overlay-wash"
      data-testid="wave-cleared"
      style={{ '--pop-in-ms': `${popInMs}ms` } as CSSProperties}
    >
      <SecretTap testId="wave-cleared-star">
        <div className="pop-in">
          <StarIcon size={260} />
        </div>
      </SecretTap>
      <LevelDots index={waveIndex} count={count} cleared size="large" />
      <div className="wave-wallet" data-testid="wave-wallet">
        <span className="hud-stat shop-wallet-inline">
          {coins}
          <CoinStack size={40} />
        </span>
        {bonus > 0 && (
          <span
            className="wave-wallet-bonus pop-in"
            data-testid="wave-clear-coins"
            style={{ animationDelay: `${rewardStaggerMs}ms` } as CSSProperties}
          >
            +{bonus}
            <CoinStack size={28} />
          </span>
        )}
      </div>
      <button
        type="button"
        className="big-button pop-in"
        data-testid="wave-next"
        aria-label="Next"
        onClick={() => {
          playUiTap();
          openShopScreen(store);
        }}
      >
        <PlayIcon size={96} />
      </button>
    </div>
  );
}
