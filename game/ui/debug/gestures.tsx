// Gesture wrappers that fire the debug menu. Kid-facing controls keep their short-tap action;
// only a 7-tap burst or a 1.2s hold opens the menu.
import {
  cloneElement,
  isValidElement,
  useRef,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { DEBUG_TRIGGERS, longPressHeld, recordTapSequence } from '../../state/debug';
import { useDebugUi } from './DebugContext';

function mergeHandler<E>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void,
): (event: E) => void {
  return (event) => {
    ours(event);
    theirs?.(event);
  };
}

export function SecretTap({
  children,
  testId,
}: {
  children: ReactElement<{
    onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
    'data-testid'?: string;
  }>;
  testId?: string;
}) {
  const debug = useDebugUi();
  const times = useRef<number[]>([]);
  if (!isValidElement(children)) return children;

  return cloneElement(children, {
    'data-testid': testId ?? children.props['data-testid'],
    onPointerDown: mergeHandler(children.props.onPointerDown, () => {
      const result = recordTapSequence(times.current, Date.now());
      times.current = result.times;
      if (result.fired) debug.setOpen(true);
    }),
  });
}

export function SecretLongPress({
  children,
  testId,
}: {
  children: ReactElement<{
    onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
    onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
    onClick?: (event: { preventDefault(): void; stopPropagation(): void }) => void;
    onContextMenu?: (event: { preventDefault(): void }) => void;
    'data-testid'?: string;
  }>;
  testId?: string;
}) {
  const debug = useDebugUi();
  const startedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    startedAt.current = null;
  };

  if (!isValidElement(children)) return children;

  return cloneElement(children, {
    'data-testid': testId ?? children.props['data-testid'],
    onContextMenu: mergeHandler(children.props.onContextMenu, (event) => {
      event.preventDefault();
    }),
    onPointerDown: mergeHandler(children.props.onPointerDown, () => {
      fired.current = false;
      startedAt.current = Date.now();
      timer.current = setTimeout(() => {
        const start = startedAt.current;
        if (start !== null && longPressHeld(start, Date.now())) {
          fired.current = true;
          debug.setOpen(true);
        }
      }, DEBUG_TRIGGERS.longPressMs);
    }),
    onPointerUp: mergeHandler(children.props.onPointerUp, () => {
      clear();
    }),
    onPointerCancel: mergeHandler(children.props.onPointerCancel, () => {
      clear();
    }),
    onPointerLeave: mergeHandler(children.props.onPointerLeave, () => {
      clear();
    }),
    onClick: (event) => {
      if (fired.current) {
        fired.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      children.props.onClick?.(event);
    },
  });
}

export function SecretTapTarget({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <SecretTap testId={testId}>
      <div className="debug-secret-target">{children}</div>
    </SecretTap>
  );
}
