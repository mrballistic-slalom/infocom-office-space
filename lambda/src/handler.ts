import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { verifyJwt } from './jwt';

const REGION = process.env.AWS_REGION ?? 'us-west-2';
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-haiku-4-5';
const BEDROCK_TIMEOUT_MS = 5000;

const ACTION_VOCAB = [
  'go', 'take', 'drop', 'use', 'examine', 'look', 'talk', 'inventory',
  'smash', 'wear', 'install', 'sit', 'wait', 'help', 'restart', 'quit',
  'save', 'load', 'unknown',
] as const;

interface IntentContext {
  roomName: string;
  exits: string[];
  items: string[];
  npcs: string[];
  inventory: string[];
}

interface ParseIntentRequest {
  input: string;
  context: IntentContext;
}

interface ParsedAction {
  action: string;
  target?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

/**
 * Validates the `Authorization: Bearer <JWT>` header. Returns true if the token is
 * missing, malformed, signature-bad, or expired — caller should short-circuit to 401.
 * Tokens are HS256-signed JWTs minted by the auth Lambda with a shared JWT_SECRET.
 */
function isUnauthorized(event: APIGatewayProxyEventV2): boolean {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Misconfigured server — fail closed.
    console.error('JWT_SECRET env var is not configured');
    return true;
  }
  const headers = event.headers ?? {};
  // API Gateway lowercases header names, but be defensive.
  const raw = headers.authorization ?? headers.Authorization ?? '';
  if (typeof raw !== 'string') return true;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  if (!m) return true;
  const { valid } = verifyJwt(m[1].trim(), secret);
  return !valid;
}

// Singleton client — Lambda re-uses across warm invocations.
const bedrock = new BedrockRuntimeClient({ region: REGION });

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

function isIntentContext(value: unknown): value is IntentContext {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.roomName === 'string' &&
    Array.isArray(c.exits) &&
    Array.isArray(c.items) &&
    Array.isArray(c.npcs) &&
    Array.isArray(c.inventory)
  );
}

function buildSystemPrompt(ctx: IntentContext): string {
  const verbs = ACTION_VOCAB.join(', ');
  return [
    'You are the intent parser for a Zork-style text adventure game.',
    'Convert the player\'s natural language input into a single structured game action.',
    '',
    `Available action verbs (use exactly one): ${verbs}`,
    '',
    'Current room context:',
    `- Room: ${ctx.roomName}`,
    `- Exits: ${ctx.exits.length ? ctx.exits.join(', ') : '(none)'}`,
    `- Visible items: ${ctx.items.length ? ctx.items.join(', ') : '(none)'}`,
    `- NPCs present: ${ctx.npcs.length ? ctx.npcs.join(', ') : '(none)'}`,
    `- Player inventory: ${ctx.inventory.length ? ctx.inventory.join(', ') : '(empty)'}`,
    '',
    'Rules:',
    '- Choose the verb that best matches the player\'s intent.',
    '- The target should be a snake_case identifier derived from a room exit, item, NPC, or direction. Convert spaces and dashes to underscores; lowercase everything.',
    '- For movement, the target should be the exit label or a direction (north/south/east/west/up/down).',
    '- If the input is ambiguous or doesn\'t fit any verb, use action "unknown" and omit target.',
    '- Some verbs (look, inventory, help, restart, quit, save, load, sit, wait) take no target.',
    '',
    'Respond with ONLY a JSON object in this exact shape, no prose, no markdown:',
    '{"action": "verb", "target": "noun_or_direction"}',
  ].join('\n');
}

function stripCodeFences(raw: string): string {
  const text = raw.trim();
  // Match ```json ... ``` or ``` ... ``` (possibly with trailing newline).
  const fenced = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return fenced ? fenced[1].trim() : text;
}

interface BedrockMessagesBody {
  content?: Array<{ type?: string; text?: string }>;
}

function extractText(body: BedrockMessagesBody): string {
  const parts: string[] = [];
  for (const c of body.content ?? []) {
    if (c.type === 'text' && typeof c.text === 'string') parts.push(c.text);
  }
  return parts.join('');
}

async function callBedrock(
  input: string,
  ctx: IntentContext,
): Promise<ParsedAction> {
  const system = buildSystemPrompt(ctx);
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 150,
    system,
    messages: [{ role: 'user', content: input }],
  };

  // AbortController gives us a hard 5s ceiling regardless of socket state.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);

  const command = new InvokeModelCommand({
    // modelId carries the cross-region inference profile ID, never a raw foundation-model ID.
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => {
        reject(new Error('Bedrock call timed out'));
      });
    });

    const sendPromise = bedrock.send(command, { abortSignal: controller.signal });
    const result = await Promise.race([sendPromise, timeoutPromise]);

    const rawBytes = result.body;
    if (!rawBytes) throw new Error('Empty Bedrock response body');
    const decoded = new TextDecoder().decode(rawBytes);
    const parsedBody = JSON.parse(decoded) as BedrockMessagesBody;
    const text = extractText(parsedBody);
    const stripped = stripCodeFences(text);
    const json = JSON.parse(stripped) as Partial<ParsedAction>;

    if (typeof json.action !== 'string') {
      return { action: 'unknown' };
    }
    const out: ParsedAction = { action: json.action };
    if (typeof json.target === 'string' && json.target.length > 0) {
      out.target = json.target;
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // Preflight (HTTP API typically handles CORS itself, but be defensive).
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (isUnauthorized(event as APIGatewayProxyEventV2)) {
    return response(401, { error: 'Unauthorized', fallback: { action: 'unknown' } });
  }

  const body = parseBody(event as APIGatewayProxyEventV2);
  if (typeof body !== 'object' || body === null) {
    return response(400, { error: 'Missing required field: input' });
  }
  const req = body as Partial<ParseIntentRequest>;

  if (typeof req.input !== 'string' || req.input.trim().length === 0) {
    return response(400, { error: 'Missing required field: input' });
  }
  if (!isIntentContext(req.context)) {
    return response(400, { error: 'Missing required field: context' });
  }

  try {
    const parsed = await callBedrock(req.input, req.context);
    return response(200, parsed);
  } catch (err) {
    console.error('Intent parsing failed:', err instanceof Error ? err.stack ?? err.message : err);
    return response(500, {
      error: 'Intent parsing failed',
      fallback: { action: 'unknown' },
    });
  }
};
