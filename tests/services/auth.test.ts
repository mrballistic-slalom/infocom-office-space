import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthService } from '@/services/auth';

describe('AuthService', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('has no token before authenticate is called', () => {
    const auth = createAuthService();
    expect(auth.hasToken()).toBe(false);
    expect(auth.getToken()).toBeNull();
  });

  it('stores and returns the server-issued token on successful authenticate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, token: 'srv-token-abc' }),
      }),
    );

    const auth = createAuthService();
    const ok = await auth.authenticate('***REDACTED***');
    expect(ok).toBe(true);
    expect(auth.hasToken()).toBe(true);
    expect(auth.getToken()).toBe('srv-token-abc');
  });

  it('returns false and stores nothing on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ ok: false }),
      }),
    );

    const auth = createAuthService();
    const ok = await auth.authenticate('wrong');
    expect(ok).toBe(false);
    expect(auth.hasToken()).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const auth = createAuthService();
    expect(await auth.authenticate('***REDACTED***')).toBe(false);
  });

  it('returns false when server responds 200 but ok=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false }),
      }),
    );
    const auth = createAuthService();
    expect(await auth.authenticate('***REDACTED***')).toBe(false);
  });

  it('clear() removes the stored token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, token: 't' }),
      }),
    );
    const auth = createAuthService();
    await auth.authenticate('***REDACTED***');
    expect(auth.hasToken()).toBe(true);
    auth.clear();
    expect(auth.hasToken()).toBe(false);
  });

  it('setToken() persists the token directly', () => {
    const auth = createAuthService();
    auth.setToken('direct-token');
    expect(auth.getToken()).toBe('direct-token');
  });
});
