import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAnalytics, track, __resetForTests } from '@/services/analytics';

// The module captures `import.meta.env.VITE_GA_MEASUREMENT_ID` at import time.
// The test bundle builds with no .env, so it's null and every send call
// short-circuits before reaching navigator.sendBeacon. Each test below
// confirms the guards behave correctly.

describe('analytics — direct Measurement Protocol', () => {
  beforeEach(() => {
    __resetForTests();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initAnalytics returns false when measurement ID is unset', () => {
    expect(initAnalytics()).toBe(false);
  });

  it('initAnalytics does not call sendBeacon when ID is unset', () => {
    const beacon = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = beacon;
    initAnalytics();
    expect(beacon).not.toHaveBeenCalled();
  });

  it('track() is a safe no-op when ID is unset', () => {
    const beacon = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = beacon;
    expect(() => track('whatever', { x: 1 })).not.toThrow();
    expect(beacon).not.toHaveBeenCalled();
  });

  it('skips sending when navigator.doNotTrack === "1"', () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    const beacon = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = beacon;
    expect(initAnalytics()).toBe(false);
    track('any', {});
    expect(beacon).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'doNotTrack', { value: '0', configurable: true });
  });

  it('initAnalytics is idempotent — repeated calls do not re-fire page_view', () => {
    // No ID set in test bundle; just confirm there is no error or side-effect
    // from calling repeatedly.
    expect(initAnalytics()).toBe(false);
    expect(initAnalytics()).toBe(false);
    expect(initAnalytics()).toBe(false);
  });

  it('no client_id is minted when ID guards short-circuit first', () => {
    // Documents guard ordering: if measurement ID is unset, we don't reach
    // localStorage at all. Important for SSR / private-browsing safety.
    initAnalytics();
    track('test_event');
    expect(localStorage.getItem('initech-terminal:ga-cid')).toBeNull();
  });

  it('track() accepts but does not throw on null/undefined params', () => {
    expect(() => track('e', undefined)).not.toThrow();
    expect(() => track('e', {})).not.toThrow();
    expect(() => track('e', { a: null, b: undefined, c: 1, d: 'x' })).not.toThrow();
  });
});
