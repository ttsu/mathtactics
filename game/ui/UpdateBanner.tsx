import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { playUiTap } from '../state/audio';
import {
  createUpdateChecker,
  shouldCheckForUpdates,
  shouldRepromptOnVisibility,
  UPDATE_CHECK_INTERVAL_MS,
} from '../state/updateCheck';

export function UpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const updateAvailableRef = useRef(false);

  useEffect(() => {
    const basePath = new URL(import.meta.env.BASE_URL, location.href).pathname;
    const buildId = import.meta.env.VITE_BUILD_ID;
    const enabled = shouldCheckForUpdates(basePath, buildId, import.meta.env.DEV);

    const checker = createUpdateChecker({
      localBuildId: buildId,
      baseUrl: import.meta.env.BASE_URL,
      enabled,
      intervalMs: UPDATE_CHECK_INTERVAL_MS,
      onUpdateAvailable: () => {
        updateAvailableRef.current = true;
        setShowBanner(true);
      },
    });

    function onVisibilityChange(): void {
      if (shouldRepromptOnVisibility(updateAvailableRef.current, document.visibilityState)) {
        setShowBanner(true);
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      checker.dispose();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  if (!showBanner) return null;

  return createPortal(
    <div className="update-banner" data-testid="update-banner" role="status">
      <span className="update-banner-text">Update available</span>
      <button
        type="button"
        className="update-banner-button"
        data-testid="update-reload"
        onClick={() => {
          playUiTap();
          location.reload();
        }}
      >
        Reload
      </button>
      <button
        type="button"
        className="update-banner-dismiss"
        data-testid="update-dismiss"
        aria-label="Dismiss"
        onClick={() => {
          playUiTap();
          setShowBanner(false);
        }}
      >
        ×
      </button>
    </div>,
    document.body,
  );
}
