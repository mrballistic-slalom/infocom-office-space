// Headless walk of the engine. Run with: npx tsx scripts/smoke.ts
import { officeSpace } from '../src/worlds/office-space';
import { initialState, execute, openingLines } from '../src/engine/engine';
import { fallbackParse } from '../src/engine/parser';
import type { GameState } from '../src/types/game';

function runScript(label: string, commands: string[]): GameState {
  const state = initialState(officeSpace);
  const log: string[] = [...openingLines(officeSpace, state)];

  for (const input of commands) {
    log.push(`> ${input}`);
    const parsed = fallbackParse(input);
    if (!parsed) {
      log.push(`[unparsed: ${input}]`);
      continue;
    }
    const res = execute(parsed, { world: officeSpace, state });
    log.push(...res.lines);
  }

  console.log(`--- ${label} ---`);
  console.log(log.join('\n'));
  return state;
}

// Cold-start dead-end tour: explore the pre-hypnosis side of the world and verify
// the design intentionally one-way-streets the player at Initech.
runScript('PART 1: dead-end tour', [
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
  'lobby',                   // recover from the cold dead-end
]);

const finalState = runScript('PART 2: critical path', [
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
]);

console.log('\n--- FINAL STATE (critical path) ---');
console.log({
  currentRoom: finalState.currentRoom,
  inventory: finalState.inventory,
  flags: finalState.flags,
  moveCount: finalState.moveCount,
  gameOver: finalState.gameOver,
});
