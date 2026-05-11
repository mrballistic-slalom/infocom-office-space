// Headless walk of the engine. Run with: npx tsx scripts/smoke.ts
import { officeSpace } from '../src/worlds/office-space';
import { initialState, execute, openingLines } from '../src/engine/engine';
import { fallbackParse } from '../src/engine/parser';

const state = initialState(officeSpace);
const log: string[] = [];

function emit(lines: string[]): void {
  for (const l of lines) log.push(l);
}

emit(openingLines(officeSpace, state));

function cmd(input: string): void {
  log.push(`> ${input}`);
  const parsed = fallbackParse(input);
  if (!parsed) {
    log.push(`[unparsed: ${input}]`);
    return;
  }
  const res = execute(parsed, { world: officeSpace, state });
  emit(res.lines);
}

// Cold world tour + critical path through liberation, scheme, virus, smash.
const script = [
  'west',                    // bedroom -> living
  'take wallet',
  'take key',
  'out',                     // living -> parking_lot
  'east',                    // -> commute
  'forward',                 // -> initech_parking
  'lobby',                   // -> initech_lobby
  'cubicles',                // -> cubicle_farm
  'east',                    // -> your_cubicle (triggers lumbergh_tps)
  'take stapler',            // triggers milton_stapler event
  'take tps reports',
  'out',                     // -> cubicle_farm
  'lobby',                   // -> initech_lobby
  'outside',                 // -> initech_parking
  // Drive home, then to therapist.
  'south',                   // -> commute_worse? no — initech_parking exits don't include south. Try drive.
  // Better: from initech_parking, find way back. exits are lobby, enter, in, north.
  // We need to get to parking_lot. We came via 'east' from commute. Reverse?
  // commute exits: switch, wait, forward, east. None go back. Cold game design.
  // So we can't drive back to therapist from work.
  // Restart approach: from initech_parking, go back via north? north goes to lobby.
  // Take new path: skip the work tour and go straight to hypnotherapist.
  'lobby',                   // -> initech_lobby (just to recover from dead-end)
];

console.log('--- PART 1: dead-end tour ---');
for (const c of script) cmd(c);

// Reset and try clean critical path.
const state2 = initialState(officeSpace);
const log2: string[] = [];
function emit2(lines: string[]): void { for (const l of lines) log2.push(l); }
emit2(openingLines(officeSpace, state2));
function cmd2(input: string): void {
  log2.push(`> ${input}`);
  const parsed = fallbackParse(input);
  if (!parsed) { log2.push(`[unparsed: ${input}]`); return; }
  const res = execute(parsed, { world: officeSpace, state: state2 });
  emit2(res.lines);
}

const criticalPath = [
  'west', 'take wallet', 'take key',     // grab things
  'out',                                  // -> parking_lot
  'north',                                // -> hypnotherapist (hypnosis fires)
  'out',                                  // -> parking_lot_post (post-hypnosis hub)
  'east',                                 // -> initech_lobby_post
  'north',                                // -> bobs_office (bobs_meeting fires)
  'south',                                // -> initech_lobby_post
  'cubicles',                             // -> cubicle_farm_post (scheme_pitch fires)
  'cubicle',                              // -> your_cubicle_post
  'server',                               // -> server_room
  'use server terminal',                  // install_virus
  'field',                                // server_room -> the_field
  'smash printer',                        // printer_smash + game_ending chain
];

console.log('\n\n--- PART 2: critical path ---');
for (const c of criticalPath) cmd2(c);

console.log(log2.join('\n'));
console.log('\n--- FINAL STATE (critical path) ---');
console.log({
  currentRoom: state2.currentRoom,
  inventory: state2.inventory,
  flags: state2.flags,
  moveCount: state2.moveCount,
  gameOver: state2.gameOver,
});
