import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { config } from './config.js';

export interface IntentContext {
  roomName: string;
  exits: string[];
  items: string[];
  npcs: string[];
  inventory: string[];
}

export interface ParsedAction {
  action: string;
  target?: string;
}

const ACTION_VOCAB = [
  'go', 'take', 'drop', 'use', 'examine', 'look', 'talk', 'inventory',
  'smash', 'snooze', 'wear', 'install', 'sit', 'wait', 'help', 'restart', 'quit',
  'save', 'load', 'unknown',
] as const;

const genai = new GoogleGenerativeAI(config.geminiKey);

// Structured-output schema. Gemini will return JSON matching this shape — no
// markdown fences, no preamble. action is required; target is optional.
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    action: {
      type: SchemaType.STRING,
      description: 'One verb from the allowed vocabulary.',
      enum: Array.from(ACTION_VOCAB),
    },
    target: {
      type: SchemaType.STRING,
      description:
        'snake_case identifier of a room exit, item, NPC, or direction. Omit for action verbs that take no target.',
      nullable: true,
    },
  },
  required: ['action'],
};

function buildSystemInstruction(ctx: IntentContext): string {
  const verbs = ACTION_VOCAB.join(', ');
  return [
    'You are the intent parser for a Zork-style text adventure game.',
    "Convert the player's natural language input into a single structured game action.",
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
    "- Choose the verb that best matches the player's intent.",
    '- The target should be a snake_case identifier derived from an exit, item, NPC, or direction. Lowercase, spaces and dashes to underscores.',
    '- For movement, the target should be an exit label or a direction (north/south/east/west/up/down).',
    "- If the input is ambiguous or doesn't fit any verb, use action 'unknown' and omit target.",
    '- Some verbs (look, inventory, help, restart, quit, save, load, sit, wait) take no target.',
  ].join('\n');
}

/**
 * Parse natural-language input into a structured game action. Returns `{action:'unknown'}`
 * on any failure (timeout, network, malformed response). Never throws.
 */
export async function parseIntent(
  input: string,
  ctx: IntentContext,
): Promise<ParsedAction> {
  const model = genai.getGenerativeModel({
    model: config.geminiModel,
    systemInstruction: buildSystemInstruction(ctx),
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      maxOutputTokens: 150,
      temperature: 0,
    },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llmTimeoutMs);

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: input }] }],
    }, { signal: controller.signal });
    const text = result.response.text();
    if (!text) return { action: 'unknown' };
    const parsed = JSON.parse(text) as Partial<ParsedAction>;
    if (typeof parsed.action !== 'string') return { action: 'unknown' };
    const out: ParsedAction = { action: parsed.action };
    if (typeof parsed.target === 'string' && parsed.target.length > 0) {
      out.target = parsed.target;
    }
    return out;
  } catch (err) {
    console.error(
      'Intent parsing failed:',
      err instanceof Error ? err.stack ?? err.message : err,
    );
    return { action: 'unknown' };
  } finally {
    clearTimeout(timer);
  }
}
