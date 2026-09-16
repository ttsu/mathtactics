// The exact-kill row (task 16 req. 4): one star icon per exact kill, popping in one after
// another, with the count itself shown in large digits beside them — numbers are allowed, words
// are not (CLAUDE.md rule 6). Shared by the win and lose screens (GDD §10.6: both show it).
// Wraps for large counts (a full M2 run has roughly 9–12 robots) rather than shrinking below
// legible size.
import type { CSSProperties } from 'react';
import { StarIcon } from './icons';
import { useAppStore } from './StoreContext';

export function ExactKillRow({ count }: { count: number }) {
  const iconStaggerMs = useAppStore((state) => state.data.presentation.screens.iconStaggerMs);

  return (
    <div className="exact-kill-row" data-testid="exact-kill-row">
      <div className="exact-kill-icons">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="exact-kill-icon pop-in"
            style={{ animationDelay: `${i * iconStaggerMs}ms` } as CSSProperties}
          >
            <StarIcon size={44} />
          </span>
        ))}
      </div>
      <span className="exact-kill-number" data-testid="exact-kill-count">
        {count}
      </span>
    </div>
  );
}
