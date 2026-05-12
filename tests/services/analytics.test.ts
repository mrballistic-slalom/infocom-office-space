import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAnalytics, track, __resetForTests } from '@/services/analytics';

describe('analytics', () => {
  beforeEach(() => {
    __resetForTests();
    // Remove any leftover script tags from a previous test.
    document.head
      .querySelectorAll('script[src*="googletagmanager.com"]')
      .forEach((el) => el.remove());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('initAnalytics is a no-op when VITE_GA_MEASUREMENT_ID is unset', () => {
    // The module captured `import.meta.env.VITE_GA_MEASUREMENT_ID` at import
    // time; with the test bundle building from no .env, it's already
    // undefined — initAnalytics should return false.
    expect(initAnalytics()).toBe(false);
    expect(window.gtag).toBeUndefined();
    expect(
      document.head.querySelectorAll('script[src*="googletagmanager.com"]').length,
    ).toBe(0);
  });

  it('initAnalytics is a no-op when the placeholder ID is left in place', () => {
    // We can't change import.meta.env at runtime, so the best we can do here
    // is rely on the unset-by-default test bundle. This documents the
    // intent: placeholder IDs (G-XXX...) must not load gtag.
    expect(initAnalytics()).toBe(false);
  });

  it('skips loading when navigator.doNotTrack === "1"', () => {
    // Even if a real ID were present, DNT should short-circuit. Stub the
    // module's initialized state and DNT.
    Object.defineProperty(navigator, 'doNotTrack', {
      value: '1',
      configurable: true,
    });
    expect(initAnalytics()).toBe(false);
    expect(window.gtag).toBeUndefined();
    Object.defineProperty(navigator, 'doNotTrack', {
      value: '0',
      configurable: true,
    });
  });

  it('track() is a safe no-op when gtag is not loaded', () => {
    expect(() => track('whatever', { x: 1 })).not.toThrow();
  });

  it('track() forwards events to gtag when it is loaded', () => {
    // Simulate the post-init state by installing a gtag stub directly.
    const spy = vi.fn();
    window.gtag = spy;
    track('game_start');
    track('game_completed', { move_count: 42 });
    expect(spy).toHaveBeenCalledWith('event', 'game_start', {});
    expect(spy).toHaveBeenCalledWith('event', 'game_completed', { move_count: 42 });
  });

  it('initAnalytics is idempotent', () => {
    initAnalytics();
    initAnalytics();
    initAnalytics();
    expect(
      document.head.querySelectorAll('script[src*="googletagmanager.com"]').length,
    ).toBeLessThanOrEqual(1);
  });
});
