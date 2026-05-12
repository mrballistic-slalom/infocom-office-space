import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { verifyJwt } from './jwt';

function makeEvent(body: unknown, isBase64 = false): APIGatewayProxyEventV2 {
  return {
    body: isBase64 ? Buffer.from(JSON.stringify(body)).toString('base64') : JSON.stringify(body),
    isBase64Encoded: isBase64,
    requestContext: { http: { method: 'POST' } },
    headers: {},
  } as unknown as APIGatewayProxyEventV2;
}

type HandlerResult = APIGatewayProxyStructuredResultV2;

function statusOf(res: void | HandlerResult): number {
  if (!res?.statusCode) throw new Error('bad response');
  return res.statusCode;
}

function bodyOf<T>(res: void | HandlerResult): T {
  if (!res?.body) throw new Error('bad response');
  return JSON.parse(res.body) as T;
}

describe('auth handler', () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = '***REDACTED***';
    process.env.JWT_SECRET = 'test-jwt-secret-must-be-long-enough-for-hmac';
  });

  afterEach(() => {
    delete process.env.APP_PASSWORD;
    delete process.env.JWT_SECRET;
  });

  it('returns 500 when APP_PASSWORD is not configured', async () => {
    delete process.env.APP_PASSWORD;
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({ password: '***REDACTED***' }), {} as never, () => undefined);
    expect(statusOf(res)).toBe(500);
  });

  it('returns 500 when JWT_SECRET is not configured', async () => {
    delete process.env.JWT_SECRET;
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({ password: '***REDACTED***' }), {} as never, () => undefined);
    expect(statusOf(res)).toBe(500);
  });

  it('returns 400 when body is not parseable', async () => {
    const { handler } = await import('./auth');
    const event = { body: 'not json', isBase64Encoded: false, requestContext: { http: { method: 'POST' } } } as unknown as APIGatewayProxyEventV2;
    const res = await handler(event, {} as never, () => undefined);
    expect(statusOf(res)).toBe(400);
  });

  it('returns 400 when password field is missing', async () => {
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({}), {} as never, () => undefined);
    expect(statusOf(res)).toBe(400);
  });

  it('returns 401 with ok:false on wrong password', async () => {
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({ password: 'wrong' }), {} as never, () => undefined);
    expect(statusOf(res)).toBe(401);
    expect(bodyOf<{ ok: boolean }>(res)).toEqual({ ok: false });
  });

  it('REJECTS case-mismatched password (no lowercase collapse)', async () => {
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({ password: 'MILTON' }), {} as never, () => undefined);
    expect(statusOf(res)).toBe(401);
  });

  it('returns 200 with a verifiable JWT on correct password', async () => {
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({ password: '***REDACTED***' }), {} as never, () => undefined);
    expect(statusOf(res)).toBe(200);
    const body = bodyOf<{ ok: boolean; token: string; expiresIn: number }>(res);
    expect(body.ok).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.token.split('.').length).toBe(3); // header.payload.signature
    expect(body.expiresIn).toBe(24 * 60 * 60);
    expect(verifyJwt(body.token, process.env.JWT_SECRET as string).valid).toBe(true);
  });

  it('issues a different jti for each successful auth (no static shared token)', async () => {
    const { handler } = await import('./auth');
    const a = bodyOf<{ token: string }>(
      await handler(makeEvent({ password: '***REDACTED***' }), {} as never, () => undefined),
    );
    const b = bodyOf<{ token: string }>(
      await handler(makeEvent({ password: '***REDACTED***' }), {} as never, () => undefined),
    );
    expect(a.token).not.toBe(b.token);
  });

  it('handles base64-encoded request bodies', async () => {
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({ password: '***REDACTED***' }, true), {} as never, () => undefined);
    expect(statusOf(res)).toBe(200);
  });

  it('trims surrounding whitespace but does not match an empty trimmed value', async () => {
    const { handler } = await import('./auth');
    const ok = await handler(makeEvent({ password: '  ***REDACTED***  ' }), {} as never, () => undefined);
    expect(statusOf(ok)).toBe(200);
    const empty = await handler(makeEvent({ password: '    ' }), {} as never, () => undefined);
    expect(statusOf(empty)).toBe(400);
  });
});
