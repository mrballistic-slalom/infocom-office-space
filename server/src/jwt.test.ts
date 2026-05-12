import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { signJwt, verifyJwt } from './jwt.js';

const SECRET = 'unit-test-jwt-secret-long-enough';

describe('jwt', () => {
  it('signJwt produces a three-segment token', () => {
    expect(signJwt(SECRET, 60).split('.').length).toBe(3);
  });

  it('verifyJwt accepts a freshly signed token', () => {
    expect(verifyJwt(signJwt(SECRET, 60), SECRET)).toEqual({ valid: true });
  });

  it('rejects a token signed with a different secret', () => {
    const result = verifyJwt(signJwt(SECRET, 60), 'other-secret');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad_signature');
  });

  it('rejects a tampered payload (signature mismatch)', () => {
    const t = signJwt(SECRET, 60);
    const [h, , s] = t.split('.');
    const tampered = `${h}.${Buffer.from('{"exp":9999999999,"jti":"x"}').toString('base64url')}.${s}`;
    expect(verifyJwt(tampered, SECRET).valid).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(verifyJwt('one.two', SECRET).valid).toBe(false);
    expect(verifyJwt('', SECRET).valid).toBe(false);
  });

  it('rejects an expired token', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const t = signJwt(SECRET, 10);
    vi.setSystemTime(new Date('2026-01-01T00:00:11Z'));
    expect(verifyJwt(t, SECRET).reason).toBe('expired');
    vi.useRealTimers();
  });

  it('rejects a token missing exp/jti', () => {
    const headerSeg = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
    const payloadSeg = Buffer.from('{"foo":"bar"}').toString('base64url');
    const signingInput = `${headerSeg}.${payloadSeg}`;
    const sig = createHmac('sha256', SECRET).update(signingInput).digest().toString('base64url');
    expect(verifyJwt(`${signingInput}.${sig}`, SECRET).reason).toBe('bad_payload');
  });

  it('two tokens issued within the same second have different jti', () => {
    expect(signJwt(SECRET, 60)).not.toBe(signJwt(SECRET, 60));
  });
});
