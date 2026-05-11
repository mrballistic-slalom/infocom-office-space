import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { timingSafeEqual } from 'node:crypto';
import { signJwt } from './jwt';

interface AuthRequest {
  password?: unknown;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// 24-hour session token. Adjust at deploy time if you want shorter/longer.
const TOKEN_TTL_SECONDS = 24 * 60 * 60;

function response(
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return null;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf-8')
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Constant-time, length-aware string equality on the byte representation.
 * Uses Node's timingSafeEqual under the hood.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf-8');
  const bb = Buffer.from(b, 'utf-8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const expected = process.env.APP_PASSWORD;
  const jwtSecret = process.env.JWT_SECRET;
  if (!expected || !jwtSecret) {
    console.error('APP_PASSWORD or JWT_SECRET env var is not configured');
    return response(500, { ok: false, error: 'Server misconfigured' });
  }

  const body = parseBody(event);
  if (typeof body !== 'object' || body === null) {
    return response(400, { ok: false, error: 'Invalid request body' });
  }
  const req = body as AuthRequest;
  // Trim only — do NOT lowercase. The previous lowercase pass shrank the keyspace
  // and made the gate trivially guessable with a dictionary-word default.
  const guess = typeof req.password === 'string' ? req.password.trim() : '';
  if (!guess) {
    return response(400, { ok: false, error: 'Missing password' });
  }

  if (!constantTimeEqual(guess, expected)) {
    return response(401, { ok: false });
  }

  // Mint a fresh, per-session, expiring JWT. Every successful auth gets its own
  // jti and exp — there is no static shared bearer token.
  const token = signJwt(jwtSecret, TOKEN_TTL_SECONDS);
  return response(200, { ok: true, token, expiresIn: TOKEN_TTL_SECONDS });
};
