import { describe, expect, it } from 'vitest';
import {
  TITLE_MATH,
  TITLE_NAME,
  TITLE_ROBOTS,
  TITLE_VS,
  titleLetterPlopDelayMs,
  titleTileFace,
} from '../../game/ui/titleEntrance';
import { parseGameData } from '../../sim/data/load';
import { loadRawGameData } from '../helpers/loadDataFiles';

describe('titleEntrance', () => {
  it('spells MATH VS ROBOTS with a tile face per MATH letter', () => {
    expect(TITLE_MATH.join('')).toBe('MATH');
    expect(TITLE_ROBOTS.join('')).toBe('ROBOTS');
    expect(TITLE_VS).toBe('VS');
    expect(TITLE_NAME).toBe('MATH VS ROBOTS');
    expect(TITLE_MATH.map((_, i) => titleTileFace(i))).toEqual([
      { letter: 'M', glyph: '+', colorKey: 'green' },
      { letter: 'A', glyph: '×', colorKey: 'orange' },
      { letter: 'T', glyph: '−', colorKey: 'blue' },
      { letter: 'H', glyph: '+', colorKey: 'green' },
    ]);
  });

  it('plops letters only after VS has started slamming', () => {
    const plopDelayMs = 560;
    const letterStaggerMs = 50;
    expect(titleLetterPlopDelayMs(0, plopDelayMs, letterStaggerMs)).toBe(plopDelayMs);
    expect(titleLetterPlopDelayMs(1, plopDelayMs, letterStaggerMs)).toBe(610);
    expect(titleLetterPlopDelayMs(5, plopDelayMs, letterStaggerMs)).toBe(810);
    expect(titleLetterPlopDelayMs(0, plopDelayMs, letterStaggerMs)).toBeGreaterThan(0);
  });
});

describe('presentation.json title entrance', () => {
  it('ships VS-first slam timing and a one-minute replay', () => {
    const data = parseGameData(loadRawGameData());
    const screens = data.presentation.screens;
    expect(screens.titleVsSlamMs).toBeGreaterThan(0);
    expect(screens.titlePlopMs).toBeGreaterThan(0);
    expect(screens.titlePlopDelayMs).toBeGreaterThan(0);
    expect(screens.titleLetterStaggerMs).toBeGreaterThan(0);
    expect(screens.titleReplayMs).toBe(60_000);
    expect(screens.titlePlopDelayMs).toBeGreaterThanOrEqual(screens.titleVsSlamMs * 0.5);
  });

  it('rejects a missing title slam duration', () => {
    const raw = loadRawGameData();
    const presentation = raw.presentation as { screens: Record<string, unknown> };
    delete presentation.screens.titleVsSlamMs;
    expect(() => parseGameData(raw)).toThrow(/presentation\.json/);
  });
});
