// Wave-cleared overlay (task 16 req. 1): a big star, the wave dots with the cleared wave filled,
// the reward tiles popping in one after another, and a big ▶ that starts the next wave. Follows
// task 11's `LevelClearedOverlay` pattern exactly (derived visibility, SVG glyphs,
// `screens.popInMs`, double-tap guard via `continueToNextWave`). This is the M2 stand-in for the
// shop slot (GDD §10.5) — removed in M3.
import type { CSSProperties } from 'react';
import type { TileId } from '../../sim/core/types';
import { continueToNextWave, showWaveCleared, waveCount, waveRewardTiles } from '../state/waveFlow';
import { PlayIcon, StarIcon } from './icons';
import { LevelDots } from './LevelDots';
import { useAppStore, useAppStoreApi } from './StoreContext';

const OPERATOR_GLYPH = { add: '+', sub: '−', mul: '×' } as const;

/** Tile face text, matching the board's own format (`/game/board/pieces.ts`) — duplicated rather
 * than imported, since `/game/ui` may never import `/game/board` (TR §2). */
function rewardLabel(tileId: TileId): string {
  const [kind, n] = tileId.split(':') as [keyof typeof OPERATOR_GLYPH, string];
  return `${OPERATOR_GLYPH[kind]}${n}`;
}

export function WaveClearedOverlay() {
  const store = useAppStoreApi();
  const visible = useAppStore(showWaveCleared);
  const waveIndex = useAppStore((state) => state.run?.waveIndex ?? 0);
  const count = useAppStore((state) => waveCount(state.data));
  const rewards = useAppStore((state) => waveRewardTiles(state.run));
  const tiles = useAppStore((state) => state.data.tiles);
  const tileColors = useAppStore((state) => state.data.presentation.tileColors);
  const popInMs = useAppStore((state) => state.data.presentation.screens.popInMs);
  const rewardStaggerMs = useAppStore((state) => state.data.presentation.screens.rewardStaggerMs);

  if (!visible) return null;

  return (
    <div
      className="overlay-wash"
      data-testid="wave-cleared"
      style={{ '--pop-in-ms': `${popInMs}ms` } as CSSProperties}
    >
      <div className="pop-in">
        <StarIcon size={260} />
      </div>
      <LevelDots index={waveIndex} count={count} cleared size="large" />
      {rewards.length > 0 && (
        <div className="reward-tiles">
          {rewards.map((tile, i) => {
            // Reward tile ids aren't validated against tiles.json at grant time (task 13
            // deviation 2); fall back to a neutral chip rather than crashing this screen, since
            // the player must get past it to keep playing.
            const def = tiles.find((candidate) => candidate.id === tile.tileId);
            const color = def ? tileColors[def.color] : '#9aa5b1';
            return (
              <div
                key={tile.pieceId}
                className="reward-tile pop-in"
                data-testid="reward-tile"
                style={
                  { background: color, animationDelay: `${i * rewardStaggerMs}ms` } as CSSProperties
                }
              >
                {rewardLabel(tile.tileId)}
              </div>
            );
          })}
        </div>
      )}
      <button
        type="button"
        className="big-button pop-in"
        data-testid="wave-next"
        aria-label="Next wave"
        onClick={() => continueToNextWave(store)}
      >
        <PlayIcon size={96} />
      </button>
    </div>
  );
}
