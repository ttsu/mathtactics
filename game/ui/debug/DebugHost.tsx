import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { isDebugHotkey, queryWantsDebug, shakeStep, type ShakeState } from '../../state/debug';
import { DebugUiProvider, useDebugUi } from './DebugContext';
import { DebugMenu } from './DebugMenu';

function DebugListeners() {
  const { open, setOpen, toggle, shakeEnabled } = useDebugUi();
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;

  useEffect(() => {
    if (queryWantsDebug(window.location.search, window.location.hash)) {
      setOpen(true);
    }
  }, [setOpen]);

  // Layout (not passive): attach before paint so a keydown the moment the menu is
  // visible is not lost — Playwright's next command can run before useEffect flushes.
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isDebugHotkey(event)) return;
      event.preventDefault();
      toggleRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  useEffect(() => {
    if (!shakeEnabled) return;
    let previous: ShakeState | null = null;
    const onMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const result = shakeStep(
        previous,
        { x: acc.x ?? 0, y: acc.y ?? 0, z: acc.z ?? 0 },
        performance.now(),
      );
      previous = result.next;
      if (result.fired) setOpen(true);
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [shakeEnabled, setOpen]);

  return open ? <DebugMenu /> : null;
}

export function DebugHost({ children }: { children: ReactNode }) {
  return (
    <DebugUiProvider>
      {children}
      <DebugListeners />
    </DebugUiProvider>
  );
}
