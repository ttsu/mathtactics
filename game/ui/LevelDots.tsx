// A row of dots, one per puzzle level (task 11 req. 3): levels before the current one are filled,
// the current one is bigger and orange, later ones are hollow. With `cleared`, the current level
// counts as done too. Text-free.

export interface LevelDotsProps {
  /** 0-based index of the current level. */
  index: number;
  count: number;
  /** The current level is done (the level-cleared overlay). */
  cleared?: boolean;
  size?: 'small' | 'large';
}

export function LevelDots({ index, count, cleared = false, size = 'small' }: LevelDotsProps) {
  return (
    <div
      className={`level-dots level-dots-${size}`}
      data-testid="level-dots"
      data-level-index={index}
      role="img"
      aria-label={`${index + 1} / ${count}`}
    >
      {Array.from({ length: count }, (_, dot) => {
        const state =
          dot < index || (cleared && dot === index) ? 'done' : dot === index ? 'current' : 'todo';
        return <span key={dot} className={`level-dot level-dot-${state}`} />;
      })}
    </div>
  );
}
