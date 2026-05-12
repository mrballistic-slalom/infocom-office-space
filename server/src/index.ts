import express from 'express';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { intentRouter } from './routes/parse-intent.js';

const app = express();

// In production we sit behind Apache/Nginx, which terminates TLS and forwards
// X-Forwarded-* headers. Trust the first hop for correct req.ip / req.protocol.
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

// Same-origin via the reverse proxy → no CORS needed in production. Keep a
// permissive header anyway in case someone proxies differently or hits the
// loopback port directly during local dev.
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  next();
});

app.options('/api/*', (_req, res) => {
  res.status(204).end();
});

// Liveness probe — useful for systemd / pm2 / a load balancer.
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/api', authRouter);
app.use('/api', intentRouter);

// JSON 404 so a misrouted request from Apache doesn't return HTML.
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = app.listen(config.port, config.host, () => {
  console.log(
    `[initech-backend] listening on ${config.host}:${config.port} ` +
      `(env=${config.nodeEnv}, model=${config.geminiModel})`,
  );
});

// Graceful shutdown — pm2 sends SIGINT, systemd sends SIGTERM. Drain in-flight
// requests before exiting so we don't bork a fetch the SPA is mid-await on.
function shutdown(signal: string): void {
  console.log(`[initech-backend] received ${signal}, draining...`);
  server.close((err) => {
    if (err) {
      console.error('[initech-backend] error during shutdown:', err);
      process.exit(1);
    }
    process.exit(0);
  });
  // Hard kill after 10s if drain stalls.
  setTimeout(() => {
    console.warn('[initech-backend] drain timed out, forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app };
