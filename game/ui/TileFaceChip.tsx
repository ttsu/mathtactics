// Read-only tile chip for the shop owned-tiles strip (and any other React face). Colour comes
// from `presentation.tileColors`; the face itself is `tileFace` (task 20).
import { tileFace } from '../state/tileFace';
import type { TileId } from '../../sim/core/types';
import type { TileColorKey } from '../state/tileFace';

export function TileFaceChip({
  tileId,
  colors,
}: {
  tileId: TileId;
  colors: Record<TileColorKey, string>;
}) {
  const face = tileFace(tileId);
  return (
    <span className="tile-face-chip" style={{ background: colors[face.colorKey] }}>
      <span className="tile-face-chip-label">
        {face.glyph}
        {face.n}
      </span>
      {face.starred && <span className="tile-face-chip-star">★</span>}
    </span>
  );
}
