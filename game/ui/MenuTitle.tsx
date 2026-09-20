// Kid-facing main-menu title: MATH as number tiles, VS in Permanent Marker, ROBOTS as robots
// with letters where HP would be. VS slams first; the rows plop in after it. Replays on a
// timer from `presentation.json` `screens.titleReplayMs`.
import { useEffect, useState, type CSSProperties, type ComponentProps } from 'react';
import type { TileColorKey } from '../state/tileFace';
import {
  TITLE_MATH,
  TITLE_NAME,
  TITLE_ROBOTS,
  TITLE_VS,
  titleLetterPlopDelayMs,
  titleTileFace,
} from './titleEntrance';

export interface MenuTitleTimings {
  readonly titleVsSlamMs: number;
  readonly titlePlopMs: number;
  readonly titlePlopDelayMs: number;
  readonly titleLetterStaggerMs: number;
  readonly titleReplayMs: number;
}

export function MenuTitle({
  tileColors,
  timings,
  style,
  ...rest
}: {
  tileColors: Record<TileColorKey, string>;
  timings: MenuTitleTimings;
} & ComponentProps<'h1'>) {
  const [play, setPlay] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPlay((n) => n + 1);
    }, timings.titleReplayMs);
    return () => window.clearInterval(id);
  }, [timings.titleReplayMs]);

  return (
    <h1
      className="menu-title"
      style={
        {
          '--title-vs-slam-ms': `${timings.titleVsSlamMs}ms`,
          '--title-plop-ms': `${timings.titlePlopMs}ms`,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      <span className="visually-hidden">{TITLE_NAME}</span>
      <span key={play} className="menu-title-art" aria-hidden="true">
        <span className="menu-title-vs" data-testid="menu-title-vs">
          {TITLE_VS}
        </span>
        <span className="menu-title-math">
          {TITLE_MATH.map((_, index) => {
            const face = titleTileFace(index);
            return (
              <span
                key={`math-${index}-${face.letter}`}
                className="menu-title-tile"
                data-testid="menu-title-tile"
                style={{
                  background: tileColors[face.colorKey],
                  animationDelay: `${titleLetterPlopDelayMs(index, timings.titlePlopDelayMs, timings.titleLetterStaggerMs)}ms`,
                }}
              >
                <span className="menu-title-tile-glyph">{face.glyph}</span>
                {face.letter}
              </span>
            );
          })}
        </span>
        <span className="menu-title-robots">
          {TITLE_ROBOTS.map((letter, index) => (
            <span
              key={`robot-${index}-${letter}`}
              className="menu-title-robot"
              data-testid="menu-title-robot"
              style={{
                animationDelay: `${titleLetterPlopDelayMs(index, timings.titlePlopDelayMs, timings.titleLetterStaggerMs)}ms`,
              }}
            >
              <span className="menu-title-robot-antenna" />
              <span className="menu-title-robot-body">{letter}</span>
              <span className="menu-title-robot-bar" />
            </span>
          ))}
        </span>
      </span>
    </h1>
  );
}
