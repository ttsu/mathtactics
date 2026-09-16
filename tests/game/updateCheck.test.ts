import { describe, expect, it, vi } from 'vitest';
import {
  createUpdateChecker,
  fetchRemoteBuildId,
  isUpdateAvailable,
  parseBuildIdFromHtml,
  resolveAppUrl,
  shouldCheckForUpdates,
  shouldRepromptOnVisibility,
} from '../../game/state/updateCheck';

describe('shouldCheckForUpdates', () => {
  it('is enabled only for production deploys with a real build id', () => {
    expect(shouldCheckForUpdates('/', 'abc1234', false)).toBe(true);
    expect(shouldCheckForUpdates('/pr/pr-12/', 'abc1234', false)).toBe(false);
    expect(shouldCheckForUpdates('/', 'abc1234', true)).toBe(false);
    expect(shouldCheckForUpdates('/', 'dev', false)).toBe(false);
    expect(shouldCheckForUpdates('/', 'local', false)).toBe(false);
    expect(shouldCheckForUpdates('/', '', false)).toBe(false);
  });
});

describe('isUpdateAvailable', () => {
  it('returns true only when remote id differs', () => {
    expect(isUpdateAvailable('abc', 'abc')).toBe(false);
    expect(isUpdateAvailable('abc', 'def')).toBe(true);
    expect(isUpdateAvailable('abc', null)).toBe(false);
  });
});

describe('parseBuildIdFromHtml', () => {
  it('reads the mt-build-id meta tag', () => {
    const html =
      '<html><head><meta name="mt-build-id" content="sha1234" /></head><body></body></html>';
    expect(parseBuildIdFromHtml(html)).toBe('sha1234');
    expect(parseBuildIdFromHtml('<html></html>')).toBeNull();
  });
});

describe('resolveAppUrl', () => {
  it('resolves relative base urls against the page href', () => {
    expect(resolveAppUrl('version.json', './', 'https://mathtactics.timtsu.com/')).toBe(
      'https://mathtactics.timtsu.com/version.json',
    );
    expect(resolveAppUrl('version.json', './', 'http://localhost:4173/')).toBe(
      'http://localhost:4173/version.json',
    );
  });
});

describe('fetchRemoteBuildId', () => {
  it('returns buildId from version.json', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ buildId: 'remote-a' }),
    })) as unknown as typeof fetch;

    const buildId = await fetchRemoteBuildId(
      './',
      fetchFn,
      () => 1,
      'https://mathtactics.timtsu.com/',
    );
    expect(buildId).toBe('remote-a');
    expect(fetchFn).toHaveBeenCalledWith('https://mathtactics.timtsu.com/version.json?t=1', {
      cache: 'no-store',
    });
  });

  it('falls back to index.html meta when version.json fails', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('version.json')) {
        return { ok: false, json: async () => ({}) };
      }
      return {
        ok: true,
        text: async () => '<meta name="mt-build-id" content="remote-b" />',
      };
    }) as unknown as typeof fetch;

    const buildId = await fetchRemoteBuildId(
      './',
      fetchFn,
      () => 2,
      'https://mathtactics.timtsu.com/',
    );
    expect(buildId).toBe('remote-b');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe('createUpdateChecker', () => {
  it('notifies when a newer build is available', async () => {
    const onUpdateAvailable = vi.fn();
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ buildId: 'remote-new' }),
    })) as unknown as typeof fetch;

    const checker = createUpdateChecker({
      localBuildId: 'local-old',
      baseUrl: './',
      enabled: true,
      intervalMs: 60_000,
      fetchFn,
      onUpdateAvailable,
      addEventListener: () => {},
      removeEventListener: () => {},
      setIntervalFn: () => 0 as unknown as ReturnType<typeof setInterval>,
      clearIntervalFn: () => {},
      setTimeoutFn: () => 0 as unknown as ReturnType<typeof setTimeout>,
      clearTimeoutFn: () => {},
    });

    await checker.check();
    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
    checker.dispose();
  });

  it('does nothing when disabled', async () => {
    const onUpdateAvailable = vi.fn();
    const checker = createUpdateChecker({
      localBuildId: 'local-old',
      baseUrl: './',
      enabled: false,
      intervalMs: 60_000,
      onUpdateAvailable,
    });

    await checker.check();
    expect(onUpdateAvailable).not.toHaveBeenCalled();
    checker.dispose();
  });
});

describe('shouldRepromptOnVisibility', () => {
  it('re-prompts only when an update is known and the page is visible', () => {
    expect(shouldRepromptOnVisibility(true, 'visible')).toBe(true);
    expect(shouldRepromptOnVisibility(true, 'hidden')).toBe(false);
    expect(shouldRepromptOnVisibility(false, 'visible')).toBe(false);
  });
});
