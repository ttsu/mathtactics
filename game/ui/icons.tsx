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
