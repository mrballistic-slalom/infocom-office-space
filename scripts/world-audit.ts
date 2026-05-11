// Reachability + dead-end audit for the Office Space world.
// Run: npx tsx scripts/world-audit.ts
import { officeSpace } from '../src/worlds/office-space';

const world = officeSpace;
const rooms = Object.keys(world.rooms);

// BFS from startRoom following ALL exits (ignoring `requires` gates).
function reachableFrom(startId: string): Set<string> {
  const visited = new Set<string>();
  const queue = [startId];
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

// Rooms not on the navigable graph at all — never reached via any exit chain
// from start. (`ending` is intentionally not navigated to; printer_smash sets
// gameOver while currentRoom stays at the_field. So `ending` is excluded.)
const SOFT_UNREACHABLE = new Set(['ending']);

const reachable = reachableFrom(world.startRoom);
const unreachable = rooms.filter((r) => !reachable.has(r) && !SOFT_UNREACHABLE.has(r));

// Rooms with only one exit (dead-end leaf rooms) — informational, not necessarily wrong.
const oneExit = rooms.filter((r) => Object.keys(world.rooms[r].exits).length <= 1);

// Rooms you can enter but can NEVER leave (no exits at all).
const noExitAtAll = rooms.filter((r) => Object.keys(world.rooms[r].exits).length === 0);

// Find rooms with no INCOMING edges (unreachable, but report separately).
const incoming = new Map<string, string[]>();
for (const r of rooms) incoming.set(r, []);
for (const [src, room] of Object.entries(world.rooms)) {
  for (const dest of Object.values(room.exits)) {
    if (!incoming.has(dest)) incoming.set(dest, []);
    incoming.get(dest)!.push(src);
  }
}
const noIncoming = rooms.filter(
  (r) => r !== world.startRoom && incoming.get(r)!.length === 0 && !SOFT_UNREACHABLE.has(r),
);

// One-way streets: A → B exists but B → A doesn't (informational — sometimes intentional).
const oneWay: string[] = [];
for (const [src, room] of Object.entries(world.rooms)) {
  for (const dest of Object.values(room.exits)) {
    const reverse = world.rooms[dest]?.exits ?? {};
    const hasReturn = Object.values(reverse).includes(src);
    if (!hasReturn) oneWay.push(`${src} → ${dest} (no return)`);
  }
}

console.log('=== ROOM COUNT ===');
console.log(`${rooms.length} rooms total`);
console.log();
console.log('=== UNREACHABLE FROM START ===');
console.log(unreachable.length === 0 ? '(none)' : unreachable.map((r) => `  - ${r}`).join('\n'));
console.log();
console.log('=== ROOMS WITH NO INCOMING EXITS ===');
console.log(noIncoming.length === 0 ? '(none)' : noIncoming.map((r) => `  - ${r}`).join('\n'));
console.log();
console.log('=== ROOMS WITH NO EXITS AT ALL ===');
console.log(noExitAtAll.length === 0 ? '(none)' : noExitAtAll.map((r) => `  - ${r}`).join('\n'));
console.log();
console.log('=== ONE-WAY STREETS (informational) ===');
console.log(oneWay.length === 0 ? '(none)' : oneWay.map((s) => `  - ${s}`).join('\n'));
console.log();
console.log('=== ROOMS WITH ≤1 EXIT (leaf rooms — fine if intentional) ===');
console.log(oneExit.map((r) => `  - ${r} (${Object.keys(world.rooms[r].exits).length})`).join('\n'));

const issues = unreachable.length + noIncoming.length + noExitAtAll.length;
console.log();
if (issues > 0) {
  console.log(`!!! ${issues} structural issues found.`);
  process.exit(1);
} else {
  console.log('✓ No structural reachability issues.');
}
