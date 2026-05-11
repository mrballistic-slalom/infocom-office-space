import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

interface AuthRequest {
  password?: unknown;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

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
 * Constant-time string equality. Cheap, but avoids leaking length via early-exit on
 * the first mismatched byte — defense against trivially timing the right password.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const expected = process.env.APP_PASSWORD;
  const sessionToken = process.env.SESSION_TOKEN;
  if (!expected || !sessionToken) {
    console.error('APP_PASSWORD or SESSION_TOKEN env var is not configured');
    return response(500, { ok: false, error: 'Server misconfigured' });
  }

  const body = parseBody(event);
  if (typeof body !== 'object' || body === null) {
    return response(400, { ok: false, error: 'Invalid request body' });
  }
  const req = body as AuthRequest;
  const guess = typeof req.password === 'string' ? req.password.trim().toLowerCase() : '';
  if (!guess) {
    return response(400, { ok: false, error: 'Missing password' });
  }

  if (!constantTimeEqual(guess, expected.toLowerCase())) {
    return response(401, { ok: false });
  }

  // On success, hand out the shared session token. Frontend sends it back as
  // `Authorization: Bearer <token>` on every /api/parse-intent call.
  return response(200, { ok: true, token: sessionToken });
};
