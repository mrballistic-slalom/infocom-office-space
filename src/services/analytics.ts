// Minimal Google Analytics 4 wrapper.
//
// - The measurement ID is read from import.meta.env.VITE_GA_MEASUREMENT_ID at
//   build time (see .env.production). If unset (or matches the placeholder),
//   gtag is never loaded — handy for local dev.
// - If the browser signals Do-Not-Track, we also skip loading gtag entirely.
// - Once loaded, gtag fires an automatic page_view on `config`. Custom events
//   go through track().

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const RAW_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const MEASUREMENT_ID =
  typeof RAW_ID === 'string' && RAW_ID && !RAW_ID.startsWith('G-XXX') ? RAW_ID : null;

let initialized = false;

function dntEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  // Both the standard property and the older MS variant.
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  return nav.doNotTrack === '1' || nav.msDoNotTrack === '1';
}

function injectGtag(id: string): void {
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer ?? [];
  // gtag is canonically defined as a thin wrapper that pushes arguments onto
  // dataLayer; the gtag.js loader picks them up once it's parsed.
  window.gtag = function gtag(...args: unknown[]): void {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', id);
}

/**
 * Initialize analytics once. Safe to call multiple times.
 * Returns true if gtag was loaded, false if skipped.
 */
export function initAnalytics(): boolean {
  if (initialized) return Boolean(window.gtag);
  initialized = true;
  if (!MEASUREMENT_ID) return false;
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (dntEnabled()) return false;
  injectGtag(MEASUREMENT_ID);
  return true;
}

/**
 * Fire a custom GA4 event. No-op when gtag isn't loaded — callers don't need
 * to guard.
 */
export function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', event, params ?? {});
}

/** For tests — reset the module-internal state. */
export function __resetForTests(): void {
  initialized = false;
  if (typeof window !== 'undefined') {
    delete window.gtag;
    delete window.dataLayer;
  }
}
