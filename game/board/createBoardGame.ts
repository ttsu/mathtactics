import Phaser from 'phaser';
import { BoardLayoutScene } from './BoardLayoutScene';
import { WORLD_HEIGHT, WORLD_WIDTH } from './layout';

export interface BoardGameOptions {
  parent: HTMLElement;
  /** Shared Web Audio context (see /game/state/audio), so Phaser doesn't create a second one. */
  audioContext?: AudioContext;
  /** Called once the canvas is placed, and again whenever Phaser re-fits it (resize, rotation). */
  onCanvasPlaced: (canvas: HTMLCanvasElement) => void;
}

/**
 * Creates the Phaser game: world = design space × UNIT, scaled to fit and centred (TR §11.2).
 */
export function createBoardGame(options: BoardGameOptions): Phaser.Game {
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
    scene: [BoardLayoutScene],
  });

  const placed = () => options.onCanvasPlaced(game.canvas);
  game.events.once(Phaser.Core.Events.READY, () => {
    placed();
    game.scale.on(Phaser.Scale.Events.RESIZE, placed);
  });

  return game;
}
