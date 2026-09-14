// Entry point — the one place that mounts both Phaser (/game/board) and React (/game/ui).
import { createRoot } from 'react-dom/client';
import { createBoardGame } from './board';
import { getAudioContext, installAudioUnlock } from './state/audio';
import { DESIGN_HEIGHT, DESIGN_WIDTH, placementOverCanvas } from './state/designSpace';
import { App } from './ui';

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing #${id}`);
  }
  return element;
}

const app = requireElement('app');
const boardRoot = requireElement('board-root');
const uiRoot = requireElement('ui-root');

// #ui-root is a 1180×820 design-space layer scaled to sit exactly over the displayed canvas
// (TR §11.2). Re-placed whenever Phaser re-fits the canvas.
uiRoot.style.width = `${DESIGN_WIDTH}px`;
uiRoot.style.height = `${DESIGN_HEIGHT}px`;

function placeUiRoot(canvas: HTMLCanvasElement): void {
  const { left, top, scale } = placementOverCanvas(
    canvas.getBoundingClientRect(),
    app.getBoundingClientRect(),
  );
  uiRoot.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  uiRoot.style.visibility = 'visible';
}

const audioContext = getAudioContext();
if (audioContext) {
  installAudioUnlock(window, audioContext);
}

createBoardGame({
  parent: boardRoot,
  audioContext: audioContext ?? undefined,
  onCanvasPlaced: placeUiRoot,
});

createRoot(uiRoot).render(<App />);
