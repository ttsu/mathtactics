// Keeps the Phaser canvas fitted to its parent (TR §11.2). Phaser-free so it can be unit tested.
//
// Why: Phaser's orientation handler re-fits using the last *recorded* parent size, then records
// the fresh size without re-fitting. Launched from the iOS Home Screen and rotated to landscape,
// `resize` fires while the page still has its portrait height, so the canvas is fitted to
// 874×812 instead of 874×402 and overflows the screen. Its 500 ms poll then sees the recorded
// size already matches and never corrects it. Re-measuring and re-fitting whenever the parent
// box actually changes size (after layout has settled) fixes that.

/** The two ScaleManager methods this needs. */
export interface FitScale {
  getParentBounds(): boolean;
  refresh(): unknown;
}

/** Calls `onResize` whenever `target` changes size; returns a function that stops observing. */
export type ObserveResize = (target: Element, onResize: () => void) => () => void;

export const observeResize: ObserveResize = (target, onResize) => {
  const observer = new ResizeObserver(onResize);
  observer.observe(target);
  return () => observer.disconnect();
};

/** Re-fits `scale` whenever `parent` changes size. Returns a function that stops observing. */
export function refitOnResize(
  scale: FitScale,
  parent: Element,
  observe: ObserveResize = observeResize,
): () => void {
  return observe(parent, () => {
    // Unconditional refresh: getParentBounds() returns false in exactly the broken case, because
    // Phaser has already recorded the new size.
    scale.getParentBounds();
    scale.refresh();
  });
}
