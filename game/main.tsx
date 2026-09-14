// Entry point — the one place that mounts both Phaser (/game/board) and React (/game/ui), and
// the edge that reads browser globals (`localStorage`, `location`, `import.meta.env.BASE_URL`)
// on behalf of the framework-free /game/state modules (TR §13, task 05 decision).
import { createRoot } from 'react-dom/client';
import { applyCommand } from '../sim/commands';
import { cellToClient, createBoardGame } from './board';
import { safeStorage } from './safeStorage';
import { gameData } from './state/gameData';
import { getAudioContext, installAudioUnlock } from './state/audio';
import { DESIGN_HEIGHT, DESIGN_WIDTH, placementOverCanvas } from './state/designSpace';
import { createAppStore } from './state/store';
import { App, StoreProvider } from './ui';

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

// TR §13 key scoping: `/` in production, `/pr/pr-12/` in a PR preview.
const basePath = new URL(import.meta.env.BASE_URL, location.href).pathname;

const store = createAppStore({
  data: gameData,
  applyCommand,
  // Guarded: a bare `localStorage` read can throw (Safari "Block All Cookies", sandboxed
  // contexts) before React ever mounts — falls back to an in-memory store rather than crashing
  // boot into a blank screen (TR §13).
  storage: safeStorage(),
  basePath,
});

const game = createBoardGame({
  parent: boardRoot,
  store,
  audioContext: audioContext ?? undefined,
  onCanvasPlaced: placeUiRoot,
});

// TR §14 / GDD §15.2: window.__GAME__ exists in dev and preview (VITE_TEST_HANDLE=1) builds
// only, never in production. The dynamic import is statically eliminated by Vite when both
// halves of the guard are false, so nothing from ./state/testHandle reaches a plain build
// (TR §14 / GDD §15.2 — verified by `npm run check:no-test-handle`).
if (import.meta.env.DEV || import.meta.env.VITE_TEST_HANDLE === '1') {
  void import('./state/testHandle').then(({ installTestHandle }) =>
    installTestHandle(store, {
      cellToClient: (cell) => cellToClient(game.canvas.getBoundingClientRect(), cell),
    }),
  );
}

createRoot(uiRoot).render(
  <StoreProvider store={store}>
    <App />
  </StoreProvider>,
);
