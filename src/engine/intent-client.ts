import type { ParsedAction } from '@/types/game';
import type { World, Room } from '@/types/world';

export interface IntentContext {
  roomName: string;
  exits: string[];
  items: string[];
  npcs: string[];
  inventory: string[];
}

export function buildContext(
  room: Room,
  world: World,
  inventory: string[],
  visibleItemIds: string[],
): IntentContext {
  return {
    roomName: room.name,
    exits: Object.keys(room.exits),
    items: visibleItemIds.map((id) => world.items[id]?.name ?? id),
    npcs: room.npcs.map((id) => world.npcs[id]?.name ?? id),
    inventory: inventory.map((id) => world.items[id]?.name ?? id),
  };
}

const ENDPOINT = '/api/parse-intent';
const TIMEOUT_MS = 5000;

export interface ParseIntentResult {
  action: ParsedAction;
  /** True when the server returned 401 — caller should force re-auth. */
  unauthorized?: boolean;
}

export async function parseIntentRemote(
  input: string,
  context: IntentContext,
  token: string | null,
): Promise<ParseIntentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input, context }),
      signal: controller.signal,
    });
    if (res.status === 401) return { action: { action: 'unknown' }, unauthorized: true };
    if (!res.ok) return { action: { action: 'unknown' } };

    const json = (await res.json()) as Partial<ParsedAction> & { fallback?: ParsedAction };
    if (json.fallback) return { action: json.fallback };
    if (typeof json.action !== 'string') return { action: { action: 'unknown' } };
    return { action: { action: json.action, target: json.target } };
  } catch {
    return { action: { action: 'unknown' } };
  } finally {
    clearTimeout(timer);
  }
}
