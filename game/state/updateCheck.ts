// Production deploy update detection (TR §15). Polls `version.json` on a timer and when the
// page becomes visible; falls back to parsing `index.html` if the JSON fetch fails.

export const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function shouldCheckForUpdates(basePath: string, buildId: string, dev: boolean): boolean {
  if (dev) return false;
  if (!buildId || buildId === 'dev' || buildId === 'local') return false;
  return basePath === '/';
}

export function isUpdateAvailable(localBuildId: string, remoteBuildId: string | null): boolean {
  return remoteBuildId !== null && remoteBuildId !== localBuildId;
}

export function parseBuildIdFromHtml(html: string): string | null {
  const match = html.match(/<meta\s+name="mt-build-id"\s+content="([^"]+)"/i);
  return match?.[1] ?? null;
}

export function resolveAppUrl(path: string, baseUrl: string, pageHref: string): string {
  return new URL(path, new URL(baseUrl, pageHref).href).href;
}

export async function fetchRemoteBuildId(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
  now: () => number = Date.now,
  pageHref: string = typeof location === 'undefined' ? 'https://mathtactics.timtsu.com/' : location.href,
): Promise<string | null> {
  const cacheBust = now();

  try {
    const versionUrl = resolveAppUrl(`version.json?t=${cacheBust}`, baseUrl, pageHref);
    const response = await fetchFn(versionUrl, { cache: 'no-store' });
    if (response.ok) {
      const data = (await response.json()) as { buildId?: unknown };
      if (typeof data.buildId === 'string' && data.buildId.length > 0) {
        return data.buildId;
      }
    }
  } catch {
    // Fall through to index.html meta parse.
  }

  try {
    const indexUrl = resolveAppUrl(`index.html?t=${cacheBust}`, baseUrl, pageHref);
    const response = await fetchFn(indexUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    const html = await response.text();
    return parseBuildIdFromHtml(html);
  } catch {
    return null;
  }
}

export type UpdateChecker = {
  check(): Promise<void>;
  dispose(): void;
};

export function createUpdateChecker(options: {
  localBuildId: string;
  baseUrl: string;
  enabled: boolean;
  intervalMs: number;
  fetchFn?: typeof fetch;
  now?: () => number;
  onUpdateAvailable: () => void;
  addEventListener?: (target: 'document' | 'window', type: string, listener: () => void) => void;
  removeEventListener?: (target: 'document' | 'window', type: string, listener: () => void) => void;
  setIntervalFn?: (handler: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearIntervalFn?: (id: ReturnType<typeof setInterval>) => void;
  setTimeoutFn?: (handler: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout>) => void;
}): UpdateChecker {
  if (!options.enabled) {
    return { check: async () => {}, dispose: () => {} };
  }

  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;
  const addEventListener =
    options.addEventListener ??
    ((target, type, listener) => {
      if (target === 'document') document.addEventListener(type, listener);
      else window.addEventListener(type, listener);
    });
  const removeEventListener =
    options.removeEventListener ??
    ((target, type, listener) => {
      if (target === 'document') document.removeEventListener(type, listener);
      else window.removeEventListener(type, listener);
    });
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;

  let disposed = false;

  async function check(): Promise<void> {
    if (disposed) return;
    const remoteBuildId = await fetchRemoteBuildId(options.baseUrl, fetchFn, now);
    if (isUpdateAvailable(options.localBuildId, remoteBuildId)) {
      options.onUpdateAvailable();
    }
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible') void check();
  }

  function onPageShow(): void {
    void check();
  }

  const intervalId = setIntervalFn(() => void check(), options.intervalMs);
  addEventListener('document', 'visibilitychange', onVisibilityChange);
  addEventListener('window', 'pageshow', onPageShow);
  const initialTimeoutId = setTimeoutFn(() => void check(), 0);

  return {
    check,
    dispose() {
      disposed = true;
      clearIntervalFn(intervalId);
      clearTimeoutFn(initialTimeoutId);
      removeEventListener('document', 'visibilitychange', onVisibilityChange);
      removeEventListener('window', 'pageshow', onPageShow);
    },
  };
}

export function shouldRepromptOnVisibility(
  updateAvailable: boolean,
  visibilityState: DocumentVisibilityState,
): boolean {
  return updateAvailable && visibilityState === 'visible';
}
