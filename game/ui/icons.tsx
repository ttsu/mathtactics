// Bold, text-free SVG glyphs shared by the task 11 screens. SVG rather than font glyphs: iOS draws
// "▶" as a colour emoji, and thin font glyphs read faintly at a distance.

/** A fat left chevron — Back on the difficulty picker. Same weight as `PlayIcon`. */
export function BackIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path
        d="M30 8 L10 24 L30 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

/** A counterclockwise circular arrow — the smaller New Game beside Continue: start over from
 * the beginning. Distinct from Continue's ▶ (and from the big orange New Game, which is also ▶
 * when there is nothing to resume). Mirrored from `PlayAgainIcon`'s clockwise arc so the head
 * points left (↺), not like a power-button stem. */
export function RestartIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path
        d="M8 24 A16 16 0 1 0 17 9.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M21 2 L8 9 L20 17 Z" fill="currentColor" />
    </svg>
  );
}

/** A jigsaw piece — Puzzles. Square body, knob on top and right, sockets on bottom and left, so
 * the silhouette still reads as a puzzle when the word is covered (GDD §11.1). */
export function PuzzlePieceIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 12 H18 A6 6 0 0 1 30 12 H40 V22 A6 6 0 0 1 40 34 V44 H30 A6 6 0 0 0 18 44 H8 V34 A6 6 0 0 0 8 22 Z"
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

/** A big round smiling face — the lose screen's "cheerful, not sad" signal (task 16 req. 3: no
 * shaming, no red X, no "game over" imagery). */
export function SmileIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#ffd166" stroke="#e09f1f" strokeWidth="5" />
      <circle cx="34" cy="42" r="7" fill="#3a2e1e" />
      <circle cx="66" cy="42" r="7" fill="#3a2e1e" />
      <path
        d="M26 56 Q50 86 74 56"
        fill="none"
        stroke="#3a2e1e"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A small rounded robot, arms out — the lose screen's "silly dance" placeholder (task 16 req.
 * 3), coloured via `currentColor` so each copy can dance in a different colour. */
export function DancingRobotIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 60 70" width={size} height={size} aria-hidden="true">
      <rect x="8" y="10" width="10" height="10" rx="4" fill="currentColor" />
      <rect x="42" y="10" width="10" height="10" rx="4" fill="currentColor" />
      <rect x="14" y="20" width="32" height="32" rx="12" fill="currentColor" />
      <circle cx="24" cy="34" r="5" fill="#ffffff" />
      <circle cx="36" cy="34" r="5" fill="#ffffff" />
      <path d="M22 42 Q30 50 38 42" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="2" y="26" width="10" height="8" rx="4" fill="currentColor" />
      <rect x="48" y="26" width="10" height="8" rx="4" fill="currentColor" />
      <rect x="18" y="52" width="10" height="14" rx="4" fill="currentColor" />
      <rect x="32" y="52" width="10" height="14" rx="4" fill="currentColor" />
    </svg>
  );
}

/** A side-on cannon: barrel plus a round body. Used on shop cannon and upgrade cards. */
export function CannonIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 48" width={size} height={Math.round(size * 0.75)} aria-hidden="true">
      <rect x="4" y="28" width="22" height="10" rx="4" fill="currentColor" />
      <circle cx="16" cy="24" r="12" fill="currentColor" />
      <rect x="24" y="16" width="34" height="12" rx="5" fill="currentColor" />
      <circle cx="16" cy="24" r="4" fill="#2f3e57" />
    </svg>
  );
}

/** A chunky cog — Settings on the main menu (task 24, GDD §18.2). */
export function GearIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M19.2 4.2 h9.6 l1.4 6.2 5.4-2.2 4.8 4.8-2.2 5.4 6.2 1.4 v9.6 l-6.2 1.4 2.2 5.4-4.8 4.8-5.4-2.2-1.4 6.2 h-9.6 l-1.4-6.2-5.4 2.2-4.8-4.8 2.2-5.4 L4.2 28.8 v-9.6 l6.2-1.4-2.2-5.4 4.8-4.8 5.4 2.2 L19.2 4.2 z M24 16 a8 8 0 1 0 0 16 a8 8 0 0 0 0-16 z"
      />
    </svg>
  );
}

/** A speaker with two sound waves — Settings Sound toggle (task 31, GDD §11.8). */
export function SpeakerIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path d="M8 18 H18 L30 8 V40 L18 30 H8 Z" fill="currentColor" />
      <path
        d="M36 18 C40 21 40 27 36 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M40 12 C48 18 48 30 40 36"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A tile with a running total under it — the Hints toggle (task 24, GDD §5.7). */
export function HintsIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect x="10" y="2" width="28" height="28" rx="7" fill="#4caf50" />
      <text
        x="24"
        y="22"
        textAnchor="middle"
        fill="#1a1a1a"
        fontSize="16"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        +4
      </text>
      <text
        x="24"
        y="44"
        textAnchor="middle"
        fill="currentColor"
        fontSize="11"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        1 → 4
      </text>
    </svg>
  );
}

/** A fat tick for a bought shop card. */
export function CheckIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path
        d="M10 26 L20 36 L38 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** iOS's Share glyph: a box with an arrow leaving the top. Drawn rather than set as a font
 * glyph so it reads at the same weight as the rest of the menu. */
export function ShareIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path
        d="M16 20 H11 V42 H37 V20 H32"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M24 5 V30" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M15 14 L24 5 L33 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
