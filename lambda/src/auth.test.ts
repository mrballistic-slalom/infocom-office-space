import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

function makeEvent(body: unknown, isBase64 = false): APIGatewayProxyEventV2 {
  return {
    body: isBase64 ? Buffer.from(JSON.stringify(body)).toString('base64') : JSON.stringify(body),
    isBase64Encoded: isBase64,
    requestContext: { http: { method: 'POST' } },
    headers: {},
  } as unknown as APIGatewayProxyEventV2;
}

describe('auth handler', () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = '***REDACTED***';
    process.env.SESSION_TOKEN = 'test-session-token';
  });

  afterEach(() => {
    delete process.env.APP_PASSWORD;
    delete process.env.SESSION_TOKEN;
  });

  it('returns 500 when APP_PASSWORD is not configured', async () => {
    delete process.env.APP_PASSWORD;
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({ password: '***REDACTED***' }), {} as never, () => undefined);
    expect(res && typeof res === 'object' && 'statusCode' in res ? res.statusCode : 0).toBe(500);
  });

  it('returns 500 when SESSION_TOKEN is not configured', async () => {
    delete process.env.SESSION_TOKEN;
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({ password: '***REDACTED***' }), {} as never, () => undefined);
    expect(res && typeof res === 'object' && 'statusCode' in res ? res.statusCode : 0).toBe(500);
  });

  it('returns 400 when body is not parseable', async () => {
    const { handler } = await import('./auth');
    const event = { body: 'not json', isBase64Encoded: false, requestContext: { http: { method: 'POST' } } } as unknown as APIGatewayProxyEventV2;
    const res = await handler(event, {} as never, () => undefined);
    expect(res && typeof res === 'object' && 'statusCode' in res ? res.statusCode : 0).toBe(400);
  });

  it('returns 400 when password field is missing', async () => {
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({}), {} as never, () => undefined);
    expect(res && typeof res === 'object' && 'statusCode' in res ? res.statusCode : 0).toBe(400);
  });

  it('returns 401 with ok:false on wrong password', async () => {
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({ password: 'wrong' }), {} as never, () => undefined);
    if (!res || typeof res !== 'object' || !('statusCode' in res)) throw new Error('bad response');
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body as string)).toEqual({ ok: false });
  });

  it('returns 200 with token on correct password (case-insensitive)', async () => {
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({ password: 'MILTON' }), {} as never, () => undefined);
    if (!res || typeof res !== 'object' || !('statusCode' in res)) throw new Error('bad response');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual({ ok: true, token: 'test-session-token' });
  });

  it('handles base64-encoded request bodies', async () => {
    const { handler } = await import('./auth');
    const res = await handler(makeEvent({ password: '***REDACTED***' }, true), {} as never, () => undefined);
    if (!res || typeof res !== 'object' || !('statusCode' in res)) throw new Error('bad response');
    expect(res.statusCode).toBe(200);
  });
});
