import { describe, expect, it, vi } from 'vitest';
import { signJwt, verifyJwt } from './jwt';

const SECRET = 'unit-test-jwt-secret-long-enough';

describe('jwt', () => {
  it('signJwt produces a three-segment token', () => {
    const t = signJwt(SECRET, 60);
    expect(t.split('.').length).toBe(3);
  });

  it('verifyJwt accepts a freshly signed token', () => {
    const t = signJwt(SECRET, 60);
    expect(verifyJwt(t, SECRET)).toEqual({ valid: true });
  });

  it('verifyJwt rejects a token signed with a different secret', () => {
    const t = signJwt(SECRET, 60);
    const result = verifyJwt(t, 'other-secret');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad_signature');
  });

  it('verifyJwt rejects a tampered payload (signature mismatch)', () => {
    const t = signJwt(SECRET, 60);
    const [h, , s] = t.split('.');
    // Swap in a different but well-formed payload.
    const tampered = `${h}.${Buffer.from('{"exp":9999999999,"jti":"x"}').toString('base64url')}.${s}`;
    const result = verifyJwt(tampered, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad_signature');
  });

  it('verifyJwt rejects a malformed token (wrong segment count)', () => {
    expect(verifyJwt('one.two', SECRET).valid).toBe(false);
    expect(verifyJwt('', SECRET).valid).toBe(false);
  });

  it('verifyJwt rejects an expired token', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const t = signJwt(SECRET, 10);
    vi.setSystemTime(new Date('2026-01-01T00:00:11Z'));
    const result = verifyJwt(t, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
    vi.useRealTimers();
  });

  it('verifyJwt rejects a token whose payload is missing exp/jti', () => {
    // Build a token by hand with no exp/jti.
    const headerSeg = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
    const payloadSeg = Buffer.from('{"foo":"bar"}').toString('base64url');
    const signingInput = `${headerSeg}.${payloadSeg}`;
    const { createHmac } = require('node:crypto') as typeof import('node:crypto');
    const sig = createHmac('sha256', SECRET).update(signingInput).digest().toString('base64url');
    const t = `${signingInput}.${sig}`;
    const result = verifyJwt(t, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad_payload');
  });

  it('two tokens issued within the same second have different jti', () => {
    const a = signJwt(SECRET, 60);
    const b = signJwt(SECRET, 60);
    expect(a).not.toBe(b);
  });
});
