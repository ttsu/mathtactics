// Entry point: mounts the Phaser board and the React UI root.
// This is a placeholder wiring (task 01) — the real app shell (layering, scaling, iPad
// web shell) is built in task 03.
import { createRoot } from 'react-dom/client';
import Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
}

function mountBoard(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1180,
    height: 820,
    scene: [BootScene],
  });
}

function mountUi(container: HTMLElement): void {
  createRoot(container).render(<div>Math Tactics</div>);
}

const boardRoot = document.getElementById('board-root');
if (!boardRoot) {
  throw new Error('missing #board-root');
}
mountBoard(boardRoot);

const uiRoot = document.getElementById('ui-root');
if (!uiRoot) {
  throw new Error('missing #ui-root');
}
mountUi(uiRoot);
