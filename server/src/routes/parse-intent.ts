import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { parseIntent, type IntentContext } from '../llm.js';

function isIntentContext(value: unknown): value is IntentContext {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.roomName === 'string' &&
    Array.isArray(c.exits) &&
    Array.isArray(c.items) &&
    Array.isArray(c.npcs) &&
    Array.isArray(c.inventory)
  );
}

export const intentRouter = Router();

/**
 * POST /api/parse-intent
 * Body: { input: string, context: IntentContext }
 * Requires Authorization: Bearer <jwt>.
 * Returns 200 { action, target? } or 500 { error, fallback }.
 */
intentRouter.post('/parse-intent', requireAuth, async (req, res) => {
  const body = req.body as Partial<{ input: unknown; context: unknown }> | undefined;
  if (!body || typeof body.input !== 'string' || body.input.trim().length === 0) {
    res.status(400).json({ error: 'Missing required field: input' });
    return;
  }
  if (!isIntentContext(body.context)) {
    res.status(400).json({ error: 'Missing required field: context' });
    return;
  }
  try {
    const parsed = await parseIntent(body.input, body.context);
    res.status(200).json(parsed);
  } catch (err) {
    console.error(
      'parse-intent route failed:',
      err instanceof Error ? err.stack ?? err.message : err,
    );
    res.status(500).json({
      error: 'Intent parsing failed',
      fallback: { action: 'unknown' },
    });
  }
});
