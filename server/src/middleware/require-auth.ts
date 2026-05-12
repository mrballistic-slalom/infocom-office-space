import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { verifyJwt } from '../jwt.js';

/**
 * Validates `Authorization: Bearer <jwt>`. Rejects missing/malformed/expired tokens
 * with a 401 carrying the same `{error, fallback}` shape the Lambda used, so the
 * frontend's intent-client.ts doesn't need to change.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers.authorization ?? '';
  const m = typeof raw === 'string' ? raw.match(/^Bearer\s+(.+)$/i) : null;
  if (!m) {
    res.status(401).json({ error: 'Unauthorized', fallback: { action: 'unknown' } });
    return;
  }
  const { valid } = verifyJwt(m[1].trim(), config.jwtSecret);
  if (!valid) {
    res.status(401).json({ error: 'Unauthorized', fallback: { action: 'unknown' } });
    return;
  }
  next();
}
