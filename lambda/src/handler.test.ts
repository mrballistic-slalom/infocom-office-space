import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const sendMock = vi.fn();

vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  class BedrockRuntimeClient {
    send = sendMock;
  }
  class InvokeModelCommand {
    public input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return { BedrockRuntimeClient, InvokeModelCommand };
});

// Imported AFTER the mock above so the handler picks up the mocked client.
import { handler } from './handler.js';

function makeEvent(body: unknown, opts: { base64?: boolean } = {}): APIGatewayProxyEventV2 {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    version: '2.0',
    routeKey: 'POST /api/parse-intent',
    rawPath: '/api/parse-intent',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'test',
      domainPrefix: 'test',
      http: {
        method: 'POST',
        path: '/api/parse-intent',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'vitest',
      },
      requestId: 'r1',
      routeKey: 'POST /api/parse-intent',
      stage: '$default',
      time: 'now',
      timeEpoch: Date.now(),
    },
    body: opts.base64 ? Buffer.from(raw).toString('base64') : raw,
    isBase64Encoded: opts.base64 ?? false,
  };
}

function makeContext() {
  return {
    roomName: 'Peter\'s Bedroom',
    exits: ['living room'],
    items: ['alarm clock'],
    npcs: [],
    inventory: [],
  };
}

function bedrockResponse(text: string) {
  const body = {
    content: [{ type: 'text', text }],
  };
  return {
    body: new TextEncoder().encode(JSON.stringify(body)),
  };
}

async function invoke(event: APIGatewayProxyEventV2) {
  // Handler is APIGatewayProxyHandlerV2; provide minimal context/callback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await (handler as any)(event, {}, () => undefined)) as {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  };
}

describe('parse-intent handler', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('returns 400 when input is missing', async () => {
    const res = await invoke(makeEvent({ context: makeContext() }));
    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.error).toMatch(/input/i);
  });

  it('returns 400 when context is missing', async () => {
    const res = await invoke(makeEvent({ input: 'go north' }));
    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.error).toMatch(/context/i);
  });

  it('returns 400 when context is malformed (not an object with required arrays)', async () => {
    const res = await invoke(makeEvent({ input: 'go north', context: { roomName: 'x' } }));
    expect(res.statusCode).toBe(400);
  });

  it('happy path returns parsed action', async () => {
    sendMock.mockResolvedValueOnce(
      bedrockResponse('{"action":"go","target":"living_room"}'),
    );
    const res = await invoke(makeEvent({ input: 'walk to the living room', context: makeContext() }));
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json).toEqual({ action: 'go', target: 'living_room' });
  });

  it('strips ```json markdown fences before parsing', async () => {
    sendMock.mockResolvedValueOnce(
      bedrockResponse('```json\n{"action":"take","target":"alarm_clock"}\n```'),
    );
    const res = await invoke(makeEvent({ input: 'grab the clock', context: makeContext() }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ action: 'take', target: 'alarm_clock' });
  });

  it('strips bare ``` fences too', async () => {
    sendMock.mockResolvedValueOnce(
      bedrockResponse('```\n{"action":"look"}\n```'),
    );
    const res = await invoke(makeEvent({ input: 'look around', context: makeContext() }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ action: 'look' });
  });

  it('handles base64-encoded bodies', async () => {
    sendMock.mockResolvedValueOnce(
      bedrockResponse('{"action":"inventory"}'),
    );
    const res = await invoke(
      makeEvent({ input: 'what do i have', context: makeContext() }, { base64: true }),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ action: 'inventory' });
  });

  it('falls back to action:unknown on Bedrock error', async () => {
    sendMock.mockRejectedValueOnce(new Error('throttled'));
    const res = await invoke(makeEvent({ input: 'go north', context: makeContext() }));
    expect(res.statusCode).toBe(500);
    const json = JSON.parse(res.body);
    expect(json.error).toBe('Intent parsing failed');
    expect(json.fallback).toEqual({ action: 'unknown' });
  });

  it('falls back to action:unknown on malformed JSON from the model', async () => {
    sendMock.mockResolvedValueOnce(bedrockResponse('I think you should go north.'));
    const res = await invoke(makeEvent({ input: 'go north', context: makeContext() }));
    expect(res.statusCode).toBe(500);
    const json = JSON.parse(res.body);
    expect(json.fallback).toEqual({ action: 'unknown' });
  });

  it('sets CORS and Content-Type headers', async () => {
    sendMock.mockResolvedValueOnce(bedrockResponse('{"action":"look"}'));
    const res = await invoke(makeEvent({ input: 'look', context: makeContext() }));
    expect(res.headers['Content-Type']).toBe('application/json');
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});
