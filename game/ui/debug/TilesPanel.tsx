import { debugAddTile } from '../../state/debug';
import { tileFace } from '../../state/tileFace';
import { useAppStore } from '../StoreContext';
import { useDebugUi } from './DebugContext';

export function TilesPanel() {
  const debug = useDebugUi();
  const tiles = useAppStore((state) => state.data.tiles);
  const colors = useAppStore((state) => state.data.presentation.tileColors);

  return (
    <div className="debug-panel" data-testid="debug-panel-tiles">
      <p className="debug-note">
        Adds one copy to the tray. Starts a new run if you are on the menu.
      </p>
      <div className="debug-grid debug-grid-tiles">
        {tiles.map((tile) => {
          const face = tileFace(tile.id);
          return (
            <button
              key={tile.id}
              type="button"
              className="debug-tile"
              data-testid={`debug-tile-${tile.id}`}
              style={{ background: colors[face.colorKey] }}
              onClick={() =>
                debug.apply(
                  debugAddTile(
                    debug.store.getState().run,
                    debug.store.getState().data,
                    tile.id,
                    debug.seed(),
                  ),
                )
              }
            >
              {face.glyph}
              {face.n}
              {face.starred ? '★' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
