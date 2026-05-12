import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Minimal HS256 JWT implementation using Node's built-in crypto. The auth route
// mints tokens here; the require-auth middleware verifies them. No third-party dep.

interface JwtPayload {
  exp: number; // Unix seconds, expiry
  iat: number; // Unix seconds, issued-at
  jti: string; // random unique ID per token
}

function b64urlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

export function signJwt(secret: string, ttlSeconds: number): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    iat: now,
    exp: now + ttlSeconds,
    jti: randomBytes(16).toString('hex'),
  };
  const headerSeg = b64urlEncode(JSON.stringify(header));
  const payloadSeg = b64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerSeg}.${payloadSeg}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest();
  return `${signingInput}.${b64urlEncode(signature)}`;
}

export interface VerifyResult {
  valid: boolean;
  reason?: 'malformed' | 'bad_signature' | 'expired' | 'bad_payload';
}

export function verifyJwt(token: string, secret: string): VerifyResult {
  if (typeof token !== 'string' || token.length === 0) {
    return { valid: false, reason: 'malformed' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };
  const [headerSeg, payloadSeg, sigSeg] = parts;

  const signingInput = `${headerSeg}.${payloadSeg}`;
  const expected = createHmac('sha256', secret).update(signingInput).digest();
  let provided: Buffer;
  try {
    provided = b64urlDecode(sigSeg);
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (expected.length !== provided.length) return { valid: false, reason: 'bad_signature' };
  if (!timingSafeEqual(expected, provided)) return { valid: false, reason: 'bad_signature' };

  let payload: Partial<JwtPayload>;
  try {
    payload = JSON.parse(b64urlDecode(payloadSeg).toString('utf-8'));
  } catch {
    return { valid: false, reason: 'bad_payload' };
  }
  if (typeof payload.exp !== 'number' || typeof payload.jti !== 'string') {
    return { valid: false, reason: 'bad_payload' };
  }
  if (Math.floor(Date.now() / 1000) >= payload.exp) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true };
}
