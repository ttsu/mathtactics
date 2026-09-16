// Overlapping gold circles as a coin-stack glyph (GDD §8.1). A 30-coin wallet uses the same
// cluster as a 1-coin wallet — the numeral is the source of truth. Shared by the shop wallet,
// offer prices, and the wave-cleared overlay.

export function CoinStack({ size = 40 }: { size?: number }) {
  const height = Math.round(size * 0.85);
  return (
    <svg viewBox="0 0 40 34" width={size} height={height} aria-hidden="true" className="coin-stack">
      <circle cx="24" cy="20" r="11" fill="#c98912" />
      <circle cx="12" cy="18" r="11" fill="#e09f1f" />
      <circle cx="18" cy="12" r="11" fill="#ffd166" stroke="#e09f1f" strokeWidth="1.5" />
    </svg>
  );
}
