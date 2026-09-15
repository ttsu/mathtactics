// Bold, text-free SVG glyphs shared by the task 11 screens. SVG rather than font glyphs: iOS draws
// "▶" as a colour emoji, and thin font glyphs read faintly at a distance.

/** A fat rounded "play" triangle. */
export function PlayIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path
        d="M14 8 L40 24 L14 40 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A circular "go round again" arrow around a play triangle. */
export function PlayAgainIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path
        d="M40 24 A16 16 0 1 1 31 9.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M27 2 L40 9 L28 17 Z" fill="currentColor" />
      <path
        d="M20 17 L31 24 L20 31 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A play triangle with a small robot head beside it — New Run (task 14 req. 3): starting a run
 * spawns robots to fight, distinguishing it by shape from the plain `PlayIcon` used for Continue. */
export function RobotPlayIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path
        d="M4 8 L26 24 L4 40 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <rect x="30" y="14" width="16" height="14" rx="4" fill="currentColor" />
      <rect x="35" y="8" width="6" height="6" rx="2" fill="currentColor" />
      <circle cx="35" cy="21" r="2.2" fill="#2f3e57" />
      <circle cx="41" cy="21" r="2.2" fill="#2f3e57" />
    </svg>
  );
}

/** A rounded tile chip with a bold "×" — Puzzles (task 14 req. 3): matches the decorative tile
 * chips already on the main menu, distinguishing it by shape from Continue/New Run's triangles. */
export function TileChipIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="10" fill="currentColor" />
      <path
        d="M15 15 L33 33 M33 15 L15 33"
        stroke="#2f3e57"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A chunky gold five-point star. */
export function StarIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path
        d="M50 6 L62 36 L94 38 L69 58 L77 90 L50 72 L23 90 L31 58 L6 38 L38 36 Z"
        fill="#ffd166"
        stroke="#e09f1f"
        strokeWidth="5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
