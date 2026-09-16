// HUD (task 03 req. 5 placeholder, task 05 req. 6: reads coins/base HP from `display` via the
// store; task 09 req. 4: End Turn and Undo dispatch real commands; task 10 req. 6: Replay; task 11
// req. 3: in level mode the level dots replace the wave, and base HP is hidden — levels never
// damage the base, TR §4.1; task 14 req. 4: in run mode the wave dots replace the "Wave N" text;
// task 14 req. 5: ⌂ Home, hidden in place. `display.baseHp` is clamped at 0 by the store (task 15
// req. 3: `displayFromRun`/`commitEvent`'s `BaseDamaged` case), the single source for the clamp —
// the HUD renders it as-is). The fire control is labelled ▶ Go (not "End Turn") so tapping to
// continue is obvious; it still dispatches `endTurn`.
import type { CSSProperties } from 'react';
import { HUD_BAR, MIN_TOUCH_TARGET } from '../state/designSpace';
import { levelPosition } from '../state/levelFlow';
import { goHome } from '../state/runFlow';
import { goButtonClassName, goNudgeAnimationKey, planningLayoutKey } from './goNudge';
import { hudButtons } from './hudButtons';
import { PlayIcon } from './icons';
import { LevelDots } from './LevelDots';
import { useAppStore, useAppStoreApi } from './StoreContext';

const touchTarget = { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET };

export function Hud() {
  const store = useAppStoreApi();
  const display = useAppStore((state) => state.display);
  const canEndTurn = useAppStore((state) => hudButtons(state).endTurn);
  const canUndo = useAppStore((state) => hudButtons(state).undo);
  const canReplay = useAppStore((state) => hudButtons(state).replay);
  const canHome = useAppStore((state) => hudButtons(state).home);
  const dispatch = useAppStore((state) => state.dispatch);
  const startReplay = useAppStore((state) => state.startReplay);
  const levelMode = useAppStore((state) => state.run?.mode === 'level');
  const levelIndex = useAppStore(
    (state) => levelPosition(state.data, state.run?.levelId)?.index ?? null,
  );
  const levelCount = useAppStore((state) => state.data.levels.levels.length);
  const waveIndex = useAppStore((state) => state.run?.waveIndex ?? 0);
  const waveCount = useAppStore((state) => state.data.waves.waves.length);
  const layoutKey = useAppStore((state) => planningLayoutKey(state.run));
  const hud = useAppStore((state) => state.data.presentation.hud);

  return (
    <div
      className="hud-bar"
      data-testid="hud-bar"
      style={{ left: HUD_BAR.x, top: HUD_BAR.y, width: HUD_BAR.width, height: HUD_BAR.height }}
    >
      {/* Hidden, not unmounted: the button keeps its slot so the dots, ♥ and 🪙 never slide
          sideways when playback starts or ends (and ♥ stays where the detonation number flies). */}
      <button
        type="button"
        className="hud-button hud-button-icon hud-button-home"
        data-testid="home"
        aria-label="Home"
        aria-hidden={!canHome}
        tabIndex={canHome ? undefined : -1}
        style={{ ...touchTarget, visibility: canHome ? 'visible' : 'hidden' }}
        disabled={!canHome}
        onClick={() => goHome(store)}
      >
        <HomeIcon />
      </button>
      {levelMode ? (
        levelIndex !== null && <LevelDots index={levelIndex} count={levelCount} />
      ) : (
        <>
          <LevelDots index={waveIndex} count={waveCount} />
          <span className="hud-stat">♥ {display.baseHp}</span>
        </>
      )}
      <span className="hud-stat">🪙 {display.coins}</span>
      <div className="hud-actions">
        <button
          type="button"
          className="hud-button hud-button-icon hud-button-replay"
          data-testid="replay"
          aria-label="Replay"
          style={touchTarget}
          disabled={!canReplay}
          onClick={() => startReplay()}
        >
          <ReplayIcon />
        </button>
        <button
          type="button"
          className="hud-button hud-button-icon hud-button-undo"
          data-testid="undo"
          aria-label="Undo"
          style={touchTarget}
          disabled={!canUndo}
          onClick={() => dispatch({ type: 'undo' })}
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className={goButtonClassName(canEndTurn)}
          data-testid="end-turn"
          key={goNudgeAnimationKey(canEndTurn, layoutKey)}
          style={
            {
              ...touchTarget,
              background: hud.goColor,
              '--go-nudge-idle-ms': `${hud.goNudgeIdleMs}ms`,
              '--go-nudge-wiggle-ms': `${hud.goNudgeWiggleMs}ms`,
              '--go-nudge-wiggle-deg': `${hud.goNudgeWiggleDeg}deg`,
            } as CSSProperties
          }
          disabled={!canEndTurn}
          // The playback Director (/game/board/playback) plays the resolved turn and calls
          // `finishPlayback` when it's done. Command is still `endTurn` (GDD §4); the
          // control is labelled Go so tapping to fire is obvious (GDD §11.1).
          onClick={() => dispatch({ type: 'endTurn' })}
        >
          <PlayIcon size={36} />
          Go
        </button>
      </div>
    </div>
  );
}

/** A bold house outline — ⌂ Home (task 14 req. 5). SVG rather than the `⌂` font glyph for the
 * same reason as `/game/ui/icons.tsx`'s glyphs: thin and faint at a distance. */
function HomeIcon() {
  return (
    <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
      <path
        d="M6 24 L24 8 L42 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 20 V40 H36 V20"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A bold curved "go back" arrow — drawn as SVG so it stays heavy and high-contrast (the `↶`
 * font glyph rendered thin and faint). */
function UndoIcon() {
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <path
        d="M16 20 H30 a10 10 0 0 1 0 20 H22"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 8 L6 20 L20 32 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A circular arrow around a play triangle — "watch that again", distinct from Undo's back arrow. */
function ReplayIcon() {
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <path
        d="M38 24 A14 14 0 1 1 30 11.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M26 3 L38 10 L27 18 Z" fill="currentColor" />
      <path d="M20 16 L32 24 L20 32 Z" fill="currentColor" />
    </svg>
  );
}
