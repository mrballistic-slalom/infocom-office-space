import { officeSpace } from '@/worlds/office-space';
import type { World } from '@/types/world';

function reachableFrom(world: World, startId: string): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const room = world.rooms[cur];
    if (!room) continue;
    for (const dest of Object.values(room.exits)) {
      if (!visited.has(dest)) queue.push(dest);
    }
  }
  return visited;
}

describe('office-space world reachability', () => {
  // `ending` is set programmatically by the game_ending event chain; it's never
  // navigated to via exits. All other rooms must be reachable from startRoom.
  const NAVIGATIONALLY_UNREACHABLE = new Set(['ending']);

  it('every non-special room is reachable from startRoom', () => {
    const reachable = reachableFrom(officeSpace, officeSpace.startRoom);
    const unreachable = Object.keys(officeSpace.rooms).filter(
      (r) => !reachable.has(r) && !NAVIGATIONALLY_UNREACHABLE.has(r),
    );
    expect(unreachable).toEqual([]);
  });

  it('every non-special room has at least one incoming exit', () => {
    const incoming = new Map<string, number>();
    for (const r of Object.keys(officeSpace.rooms)) incoming.set(r, 0);
    for (const room of Object.values(officeSpace.rooms)) {
      for (const dest of Object.values(room.exits)) {
        incoming.set(dest, (incoming.get(dest) ?? 0) + 1);
      }
    }
    const orphans = [...incoming.entries()]
      .filter(
        ([id, n]) =>
          n === 0 &&
          id !== officeSpace.startRoom &&
          !NAVIGATIONALLY_UNREACHABLE.has(id),
      )
      .map(([id]) => id);
    expect(orphans).toEqual([]);
  });

  it('every exit destination resolves to a real room', () => {
    const ids = new Set(Object.keys(officeSpace.rooms));
    const broken: string[] = [];
    for (const [src, room] of Object.entries(officeSpace.rooms)) {
      for (const [label, dest] of Object.entries(room.exits)) {
        if (!ids.has(dest)) broken.push(`${src}.${label} → ${dest} (no such room)`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('every event referenced by onEnter or onTake exists', () => {
    const events = new Set(Object.keys(officeSpace.events));
    const missing: string[] = [];
    for (const [src, room] of Object.entries(officeSpace.rooms)) {
      for (const trigger of room.onEnter) {
        if (!events.has(trigger.then)) {
          missing.push(`${src}.onEnter → ${trigger.then} (no such event)`);
        }
      }
    }
    for (const [id, item] of Object.entries(officeSpace.items)) {
      if (item.onTake && !events.has(item.onTake)) {
        missing.push(`item ${id}.onTake → ${item.onTake} (no such event)`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every NPC referenced by a room exists in the npcs map', () => {
    const npcIds = new Set(Object.keys(officeSpace.npcs));
    const missing: string[] = [];
    for (const [src, room] of Object.entries(officeSpace.rooms)) {
      for (const id of room.npcs) {
        if (!npcIds.has(id)) missing.push(`${src} references missing NPC ${id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every item referenced by a room exists in the items map', () => {
    const itemIds = new Set(Object.keys(officeSpace.items));
    const missing: string[] = [];
    for (const [src, room] of Object.entries(officeSpace.rooms)) {
      for (const id of room.items) {
        if (!itemIds.has(id)) missing.push(`${src} references missing item ${id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every required-flag gate uses a flag that some event sets', () => {
    // Collect all flags referenced by `requires` clauses on rooms.
    const requiredFlags = new Set<string>();
    for (const room of Object.values(officeSpace.rooms)) {
      if (!room.requires) continue;
      const m = room.requires.match(/^!?flag:(.+)$/);
      if (m) requiredFlags.add(m[1]);
    }
    // Collect all flags ever set via event-script `[Flag set: ...]` lines.
    const FLAG_LABEL_TO_ID: Record<string, string> = {
      'lumbergh has visited': 'lumbergh_visited',
      'took the stapler': 'took_stapler',
      hypnotized: 'hypnotized',
      'met the bobs': 'met_bobs',
      'met joanna': 'met_joanna',
      'has scheme': 'has_scheme',
      'virus installed': 'virus_installed',
      'printer destroyed': 'printer_destroyed',
    };
    const settableFlags = new Set<string>();
    for (const lines of Object.values(officeSpace.events)) {
      for (const line of lines) {
        const m = line.match(/Flag set:\s*(.+?)\]/i);
        if (m) {
          const id = FLAG_LABEL_TO_ID[m[1].toLowerCase().trim()];
          if (id) settableFlags.add(id);
        }
      }
    }
    const unsettable = [...requiredFlags].filter((f) => !settableFlags.has(f));
    expect(unsettable).toEqual([]);
  });
});
