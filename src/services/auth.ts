const STORAGE_KEY = 'initech-terminal:auth';
const ENDPOINT = '/api/auth';
const TIMEOUT_MS = 5000;

function detectStorage(): Storage | null {
  try {
    const probe = '__initech_auth_probe__';
    window.sessionStorage.setItem(probe, '1');
    window.sessionStorage.removeItem(probe);
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export interface AuthService {
  hasToken(): boolean;
  getToken(): string | null;
  setToken(token: string): void;
  clear(): void;
  /** POST the guess to /api/auth; on 200 stores the token and returns true. */
  authenticate(password: string): Promise<boolean>;
}

export function createAuthService(): AuthService {
  const storage = detectStorage();

  return {
    hasToken: () => Boolean(storage?.getItem(STORAGE_KEY)),
    getToken: () => storage?.getItem(STORAGE_KEY) ?? null,
    setToken: (token) => storage?.setItem(STORAGE_KEY, token),
    clear: () => storage?.removeItem(STORAGE_KEY),

    async authenticate(password) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
          signal: controller.signal,
        });
        if (!res.ok) return false;
        const json = (await res.json()) as { ok?: boolean; token?: string };
        if (json.ok && typeof json.token === 'string') {
          storage?.setItem(STORAGE_KEY, json.token);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
