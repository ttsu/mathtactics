import Phaser from 'phaser';
import type { StoreApi } from 'zustand/vanilla';
import type { AppStore } from '../state/store';
import { BoardScene } from './BoardScene';
import type { PlanningHintMark } from './planningHints';
import { WORLD_HEIGHT, WORLD_WIDTH } from './layout';
import { refitOnResize } from './refitOnResize';
import type { RobotChromeSnapshot } from './views/RobotView';

/** The mounted board: the Phaser game plus the playback controls the test handle needs. */
export interface BoardGame {
  game: Phaser.Game;
  /** Finishes any playback sequence instantly (test handle `skipAnimation`, TR §14). */
  skipAnimation(): void;
  /** True while the playback Director has a sequence, tweens or timers pending. */
  isAnimating(): boolean;
  /** What the board draws right now, in design points (test handle `renderedBoard`, TR §14). */
  drawn(): { robots: { robotId: string; x: number; y: number }[]; tiles: string[] };
  /** Live trait chrome as drawn (test handle `getRobotChrome`, TR §14). */
  robotChrome(robotId: string): RobotChromeSnapshot | null;
  /** Planning-hint numerals currently drawn (test handle `getHints`, TR §14). */
  drawnHints(): PlanningHintMark[];
}

export interface BoardGameOptions {
  parent: HTMLElement;
  /** The app store the board renders from and dispatches planning commands to (TR §10). */
  store: StoreApi<AppStore>;
  /** Shared Web Audio context (see /game/state/audio), so Phaser doesn't create a second one. */
  audioContext?: AudioContext;
  /** Called once the canvas is placed, and again whenever Phaser re-fits it (resize, rotation). */
  onCanvasPlaced: (canvas: HTMLCanvasElement) => void;
}

/**
 * Creates the Phaser game: world = design space × UNIT, scaled to fit and centred (TR §11.2).
 */
export function createBoardGame(options: BoardGameOptions): BoardGame {
  const scene = new BoardScene(options.store);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    backgroundColor: '#fbf7ee',
    banner: false,
    audio: options.audioContext ? { context: options.audioContext } : undefined,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    },
    scene: [scene],
  });

  const placed = () => options.onCanvasPlaced(game.canvas);
  game.events.once(Phaser.Core.Events.READY, () => {
    placed();
    game.scale.on(Phaser.Scale.Events.RESIZE, placed);
    const stopRefitting = refitOnResize(game.scale, options.parent);
    game.events.once(Phaser.Core.Events.DESTROY, stopRefitting);
  });

  return {
    game,
    skipAnimation: () => scene.director?.skipAll(),
    isAnimating: () => scene.director?.busy ?? false,
    drawn: () => scene.boardView?.drawn() ?? { robots: [], tiles: [] },
    robotChrome: (robotId) => scene.boardView?.robotChrome(robotId) ?? null,
    drawnHints: () => scene.boardView?.drawnHints() ?? [],
  };
}
