import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import '../test-setup.js';
import { TEST_JWT_SECRET, TEST_PASSWORD } from '../test-setup.js';
import { signJwt } from '../jwt.js';

// vi.hoisted so the mock factory sees the spy at hoist time.
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('@google/generative-ai', () => {
  class GoogleGenerativeAI {
    constructor(_apiKey: string) {}
    getGenerativeModel() {
      return { generateContent };
    }
  }
  return {
    GoogleGenerativeAI,
    SchemaType: { OBJECT: 'OBJECT', STRING: 'STRING' },
  };
});

// Imported AFTER the mock — picks up the stubbed Gemini client.
const { app } = await import('../index.js');

function geminiText(text: string) {
  return { response: { text: () => text } };
}

function makeContext() {
  return {
    roomName: "Initech Lobby",
    exits: ['cubicle_farm', 'break_room', 'east', 'outside'],
    items: [],
    npcs: [],
    inventory: ['wallet'],
  };
}

function validToken(): string {
  return signJwt(TEST_JWT_SECRET, 60);
}

async function authedPost(body: unknown, auth?: string) {
  const req = request(app).post('/api/parse-intent');
  if (auth !== null) {
    req.set('Authorization', auth ?? `Bearer ${validToken()}`);
  }
  return req.send(body as object);
}

describe('POST /api/parse-intent', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app)
      .post('/api/parse-intent')
      .send({ input: 'go north', context: makeContext() });
    expect(res.status).toBe(401);
  });

  it('returns 401 with a bad-signature token', async () => {
    const wrong = signJwt('different-secret-not-the-real-one', 60);
    const res = await authedPost(
      { input: 'go north', context: makeContext() },
      `Bearer ${wrong}`,
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 with an expired token', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const t = signJwt(TEST_JWT_SECRET, 10);
    vi.setSystemTime(new Date('2026-01-01T00:00:11Z'));
    const res = await authedPost(
      { input: 'go north', context: makeContext() },
      `Bearer ${t}`,
    );
    expect(res.status).toBe(401);
    vi.useRealTimers();
  });

  it('returns 400 when input is missing', async () => {
    const res = await authedPost({ context: makeContext() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/input/i);
  });

  it('returns 400 when context is malformed', async () => {
    const res = await authedPost({ input: 'go north', context: { roomName: 'x' } });
    expect(res.status).toBe(400);
  });

  it('happy path returns the parsed action', async () => {
    generateContent.mockResolvedValueOnce(geminiText('{"action":"go","target":"cubicle_farm"}'));
    const res = await authedPost({ input: 'walk to the cubicles', context: makeContext() });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ action: 'go', target: 'cubicle_farm' });
  });

  it('returns {action:"unknown"} on malformed JSON from Gemini (with 200)', async () => {
    // llm.ts swallows JSON errors and returns {action:'unknown'}, so the route returns 200.
    generateContent.mockResolvedValueOnce(geminiText('not json at all'));
    const res = await authedPost({ input: 'do something weird', context: makeContext() });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ action: 'unknown' });
  });

  it('returns {action:"unknown"} on Gemini errors', async () => {
    generateContent.mockRejectedValueOnce(new Error('Gemini exploded'));
    const res = await authedPost({ input: 'go north', context: makeContext() });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ action: 'unknown' });
  });

  it('omits target field when Gemini returns only an action', async () => {
    generateContent.mockResolvedValueOnce(geminiText('{"action":"look"}'));
    const res = await authedPost({ input: 'look around', context: makeContext() });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ action: 'look' });
  });
});

describe('GET /health', () => {
  it('responds 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('unknown route', () => {
  it('returns JSON 404, not HTML', async () => {
    const res = await request(app).get('/no-such-route');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
