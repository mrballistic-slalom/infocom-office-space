import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { signJwt } from '../jwt.js';

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf-8');
  const bb = Buffer.from(b, 'utf-8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const authRouter = Router();

/**
 * POST /api/auth
 * Body: { password: string }
 * On match: 200 { ok: true, token, expiresIn }.  On miss: 401 { ok: false }.
 */
authRouter.post('/auth', (req, res) => {
  const body = req.body as { password?: unknown } | undefined;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ ok: false, error: 'Invalid request body' });
    return;
  }
  const guess = typeof body.password === 'string' ? body.password.trim() : '';
  if (!guess) {
    res.status(400).json({ ok: false, error: 'Missing password' });
    return;
  }
  if (!constantTimeEqual(guess, config.appPassword)) {
    res.status(401).json({ ok: false });
    return;
  }
  const token = signJwt(config.jwtSecret, config.tokenTtlSeconds);
  res.status(200).json({ ok: true, token, expiresIn: config.tokenTtlSeconds });
});
