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

export async function parseIntentRemote(
  input: string,
  context: IntentContext,
): Promise<ParsedAction> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, context }),
      signal: controller.signal,
    });
    if (!res.ok) return { action: 'unknown' };
    const json = (await res.json()) as Partial<ParsedAction> & { fallback?: ParsedAction };
    if (json.fallback) return json.fallback;
    if (typeof json.action !== 'string') return { action: 'unknown' };
    return { action: json.action, target: json.target };
  } catch {
    return { action: 'unknown' };
  } finally {
    clearTimeout(timer);
  }
}
