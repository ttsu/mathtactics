import { useDebugUi } from './DebugContext';
import { useAppStore } from '../StoreContext';
import { debugJumpToLevel, debugJumpToWave } from '../../state/debug';

export function JumpPanel() {
  const debug = useDebugUi();
  const levels = useAppStore((state) => state.data.levels.levels);
  const waves = useAppStore((state) => state.data.waves.waves);
  const run = useAppStore((state) => state.run);

  return (
    <div className="debug-panel" data-testid="debug-panel-jump">
      <p className="debug-note">
        Puzzles replace the board only. Jumping to a wave writes the save (Continue will resume
        there). Forward jumps keep your tiles.
      </p>
      <h3 className="debug-heading">Puzzles</h3>
      <div className="debug-grid">
        {levels.map((level, index) => (
          <button
            key={level.id}
            type="button"
            className="debug-chip"
            data-testid={`debug-level-${level.id}`}
            aria-current={run?.mode === 'level' && run.levelId === level.id}
            onClick={() => debug.apply(debugJumpToLevel(debug.store.getState().data, level.id))}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <h3 className="debug-heading">Waves</h3>
      <div className="debug-grid">
        {waves.map((wave, index) => (
          <button
            key={wave.id}
            type="button"
            className="debug-chip"
            data-testid={`debug-wave-${index + 1}`}
            aria-current={run?.mode === 'run' && run.waveIndex === index}
            onClick={() => {
              const { run: current, data } = debug.store.getState();
              debug.apply(debugJumpToWave(current, data, index, debug.seed()));
            }}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
