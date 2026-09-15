import { describe, expect, it } from 'vitest';
import { refitOnResize, type FitScale } from '../../game/board/refitOnResize';

function fakeObserver() {
  let callback: (() => void) | undefined;
  let disconnected = false;
  return {
    observe: (_target: Element, onResize: () => void) => {
      callback = onResize;
      return () => {
        disconnected = true;
      };
    },
    fire: () => callback?.(),
    get disconnected() {
      return disconnected;
    },
  };
}

describe('refitOnResize', () => {
  it('re-measures the parent and re-fits even when Phaser already recorded the new size', () => {
    // iOS Home Screen rotation: Phaser re-fits against a stale portrait height, then records
    // the settled landscape size without re-fitting, so getParentBounds() reports "unchanged".
    const calls: string[] = [];
    const scale: FitScale = {
      getParentBounds: () => {
        calls.push('measure');
        return false;
      },
      refresh: () => {
        calls.push('refresh');
      },
    };
    const observer = fakeObserver();

    refitOnResize(scale, {} as Element, observer.observe);
    expect(calls).toEqual([]);

    observer.fire();
    expect(calls).toEqual(['measure', 'refresh']);
  });

  it('stops observing when disposed', () => {
    const observer = fakeObserver();
    const dispose = refitOnResize(
      { getParentBounds: () => true, refresh: () => undefined },
      {} as Element,
      observer.observe,
    );

    dispose();
    expect(observer.disconnected).toBe(true);
  });
});
