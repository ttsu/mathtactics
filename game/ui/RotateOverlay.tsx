// Full-screen, text-free "rotate your device" overlay shown in portrait (GDD §3.2, TR §15).
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
}

function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

export function RotateOverlay() {
  const portrait = useSyncExternalStore(subscribe, isPortrait);
  if (!portrait) return null;

  // Portalled to <body>: #ui-root is scaled into design space, which would shrink and offset a
  // viewport-sized overlay.
  return createPortal(
    <div className="rotate-overlay" data-testid="rotate-overlay" role="img" aria-label="Rotate">
      <svg viewBox="0 0 200 200" width="240" height="240" aria-hidden="true">
        {/* Phone upright (faint) */}
        <rect
          x="70"
          y="40"
          width="60"
          height="110"
          rx="10"
          fill="none"
          stroke="#ffffff55"
          strokeWidth="6"
        />
        {/* Phone turned landscape */}
        <rect
          x="45"
          y="95"
          width="110"
          height="60"
          rx="10"
          fill="none"
          stroke="#fff"
          strokeWidth="8"
        />
        <circle cx="143" cy="125" r="5" fill="#fff" />
        {/* Turning arrow */}
        <path
          d="M150 60 A55 55 0 0 1 172 105"
          fill="none"
          stroke="#ffd166"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M160 102 L172 112 L181 98"
          fill="none"
          stroke="#ffd166"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>,
    document.body,
  );
}
