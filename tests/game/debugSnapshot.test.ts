import { describe, expect, it } from 'vitest';
import {
  buildDebugSnapshot,
  DEBUG_SNAPSHOT_KIND,
  parseDebugSnapshot,
  stringifyDebugSnapshot,
} from '../../game/state/debug';
import { DEFAULT_SETTINGS } from '../../game/state/storage';
import { debugJumpToLevel } from '../../game/state/debug';
import { realData } from './boardFixtures';

describe('debug snapshot', () => {
  it('round-trips a wrapped snapshot to the same run', () => {
    const jumped = debugJumpToLevel(realData, 'level-2');
    expect(jumped.ok).toBe(true);
    if (!jumped.ok) return;
    const snapshot = buildDebugSnapshot(
      {
        run: jumped.run,
        screen: 'game',
        display: { coins: 0, baseHp: 100, waveIndex: 0 },
        settings: DEFAULT_SETTINGS,
        lastTurn: null,
        playbackStatus: 'idle',
      },
      1_700_000_000_000,
    );
    expect(snapshot.kind).toBe(DEBUG_SNAPSHOT_KIND);
    expect(snapshot.summary).toContain('level-2');
    const text = stringifyDebugSnapshot(snapshot);
    const parsed = parseDebugSnapshot(text);
    expect(parsed).toEqual({ ok: true, run: jumped.run });
  });

  it('also accepts a raw RunState JSON blob', () => {
    const jumped = debugJumpToLevel(realData, 'level-1');
    expect(jumped.ok).toBe(true);
    if (!jumped.ok) return;
    const parsed = parseDebugSnapshot(JSON.stringify(jumped.run));
    expect(parsed).toEqual({ ok: true, run: jumped.run });
  });

  it('rejects junk', () => {
    expect(parseDebugSnapshot('not json')).toEqual({ ok: false, error: 'not JSON' });
    expect(parseDebugSnapshot('{"kind":"nope"}')).toEqual({
      ok: false,
      error: 'unknown snapshot kind',
    });
  });
});
