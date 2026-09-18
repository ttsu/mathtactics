import { useEffect, useState } from 'react';
import { buildDebugSnapshot, parseDebugSnapshot, stringifyDebugSnapshot } from '../../state/debug';
import { useAppStore } from '../StoreContext';
import { useDebugUi } from './DebugContext';

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function SnapshotPanel() {
  const debug = useDebugUi();
  const run = useAppStore((state) => state.run);
  const screen = useAppStore((state) => state.screen);
  const display = useAppStore((state) => state.display);
  const settings = useAppStore((state) => state.settings);
  const lastTurn = useAppStore((state) => state.lastTurn);
  const playbackStatus = useAppStore((state) => state.playback.status);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setText(
      stringifyDebugSnapshot(
        buildDebugSnapshot(
          { run, screen, display, settings, lastTurn, playbackStatus },
          Date.now(),
        ),
      ),
    );
  }, [run, screen, display, settings, lastTurn, playbackStatus]);

  return (
    <div className="debug-panel" data-testid="debug-panel-snapshot">
      <p className="debug-note">
        Copy this JSON into a chat with an agent. Load pastes a snapshot back onto the board.
      </p>
      <div className="debug-row">
        <button
          type="button"
          className="debug-action"
          data-testid="debug-copy"
          onClick={async () => {
            const body = stringifyDebugSnapshot(
              buildDebugSnapshot(
                { run, screen, display, settings, lastTurn, playbackStatus },
                Date.now(),
              ),
            );
            setText(body);
            const copied = await writeClipboard(body);
            setStatus(copied ? 'Copied' : 'Select the text and copy');
          }}
        >
          Copy
        </button>
        <button
          type="button"
          className="debug-action debug-action-secondary"
          data-testid="debug-load"
          onClick={() => {
            const parsed = parseDebugSnapshot(text);
            if (!parsed.ok) {
              setStatus(parsed.error);
              return;
            }
            debug.store.getState().installRun(parsed.run);
            setStatus('Loaded');
          }}
        >
          Load
        </button>
      </div>
      {status && (
        <p className="debug-status" data-testid="debug-snapshot-status">
          {status}
        </p>
      )}
      <textarea
        className="debug-snapshot"
        data-testid="debug-snapshot"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  );
}
