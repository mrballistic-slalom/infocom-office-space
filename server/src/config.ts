// Centralized env-var loading. Throws at module init if anything required is missing
// so the process refuses to start in a broken state.

function require_env(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(
      `Missing required env var: ${name}. ` +
        `Set it in /etc/initech.env (production) or server/.env (local dev).`,
    );
  }
  return v;
}

function optional_env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : fallback;
}

export const config = {
  geminiKey: require_env('GEMINI_KEY'),
  port: Number.parseInt(optional_env('PORT', '3001'), 10),
  // Bind to loopback by default — Apache/Nginx in front handles the public port.
  host: optional_env('HOST', '127.0.0.1'),
  nodeEnv: optional_env('NODE_ENV', 'development'),
  // Gemini model. Use 2.0 Flash on the free tier; flip to 2.5 Flash if you have access.
  geminiModel: optional_env('GEMINI_MODEL', 'gemini-2.0-flash'),
  // Hard ceiling on LLM call latency.
  llmTimeoutMs: 5_000,
} as const;
