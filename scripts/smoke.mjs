// Headless walk of the critical path through the deterministic engine.
// Run with: node scripts/smoke.mjs
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Use tsx loader to import .ts directly.
register('tsx/esm', pathToFileURL('./'));

const { officeSpace } = await import('../src/worlds/office-space.ts');
const { initialState, execute, openingLines } = await import('../src/engine/engine.ts');
const { fallbackParse } = await import('../src/engine/parser.ts');

const state = initialState(officeSpace);
const log = [];

function emit(lines) {
  for (const l of lines) log.push(l);
}

emit(openingLines(officeSpace, state));

function cmd(input) {
  log.push(`> ${input}`);
  const parsed = fallbackParse(input);
  if (!parsed) {
    log.push(`[unparsed: ${input}]`);
    return;
  }
  const res = execute(parsed, { world: officeSpace, state });
  emit(res.lines);
}

// Critical path attempt.
const script = [
  'west',                       // bedroom -> living
  'take wallet',
  'take key',
  'out',                        // -> parking lot
  'north',                      // -> hypnotherapist (triggers hypnosis)
  'wait',
  'south',                      // -> parking lot post (state should be post-hypnosis)
  'east',                       // -> initech lobby post
  'north',                      // -> bobs office (triggers bobs meeting)
  'south',                      // -> lobby post
  'east',                       // -> cubicle farm post (triggers scheme pitch)
  'east',                       // -> your cubicle post
  'north',                      // -> server room
  'use server terminal',
  'south',                      // back to cubicle post
  'west',                       // back to cubicle farm post
  'west',                       // back to lobby post
  // Need to navigate to break_room_post or the_field to smash.
  // Easier path: cubicle_post -> server_room -> field
  'east',                       // cubicle farm post
  'east',                       // your cubicle post
  'north',                      // server room
  'north',                      // the field
  'smash printer',
];

for (const c of script) cmd(c);

console.log(log.join('\n'));
console.log('\n--- FINAL STATE ---');
console.log({
  currentRoom: state.currentRoom,
  inventory: state.inventory,
  flags: state.flags,
  moveCount: state.moveCount,
  gameOver: state.gameOver,
});
