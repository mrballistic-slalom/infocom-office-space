import { describe, expect, it } from 'vitest';
import request from 'supertest';
import '../test-setup.js';
import { TEST_JWT_SECRET, TEST_PASSWORD } from '../test-setup.js';
import { verifyJwt } from '../jwt.js';
import { app } from '../index.js';

describe('POST /api/auth', () => {
  it('returns 400 when body is missing', async () => {
    const res = await request(app).post('/api/auth').send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('returns 400 when password is whitespace only', async () => {
    const res = await request(app).post('/api/auth').send({ password: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app).post('/api/auth').send({ password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false });
  });

  it('rejects case-mismatched password (no lowercase collapse)', async () => {
    const res = await request(app)
      .post('/api/auth')
      .send({ password: TEST_PASSWORD.toUpperCase() });
    expect(res.status).toBe(401);
  });

  it('returns 200 with a verifiable JWT on correct password', async () => {
    const res = await request(app).post('/api/auth').send({ password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.split('.').length).toBe(3);
    expect(res.body.expiresIn).toBe(24 * 60 * 60);
    expect(verifyJwt(res.body.token, TEST_JWT_SECRET).valid).toBe(true);
  });

  it('issues a different jti for each successful auth', async () => {
    const a = await request(app).post('/api/auth').send({ password: TEST_PASSWORD });
    const b = await request(app).post('/api/auth').send({ password: TEST_PASSWORD });
    expect(a.body.token).not.toBe(b.body.token);
  });

  it('trims surrounding whitespace on the guess', async () => {
    const res = await request(app)
      .post('/api/auth')
      .send({ password: `  ${TEST_PASSWORD}  ` });
    expect(res.status).toBe(200);
  });
});
