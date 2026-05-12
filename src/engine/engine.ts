import type { GameState, ParsedAction } from '@/types/game';
import type { World } from '@/types/world';
import { evaluateCondition } from './conditions';
import { fuzzyMatch, fuzzyMatchExit } from './fuzzy';

export interface EngineResult {
  /** Lines to append to the output log. */
  lines: string[];
  /** Set true if the engine state changed (so the store should persist). */
  mutated: boolean;
}

export interface EngineDeps {
  world: World;
  state: GameState;
}

export function initialState(world: World): GameState {
  return {
    currentRoom: world.startRoom,
    inventory: [],
    flags: {},
    moveCount: 0,
    gameOver: false,
    itemsRemoved: {},
    itemsAdded: {},
    firedEvents: [],
  };
}

/** Apply structural mutations indicated by an event script's bracketed system lines. */
function applyEventEffects(eventKey: string, world: World, state: GameState): void {
  const lines = world.events[eventKey] ?? [];
  for (const line of lines) {
    if (!line.startsWith('[')) continue;

    const flagSet = line.match(/Flag set:\s*(.+?)\]/i);
    if (flagSet) {
      const flagId = labelToFlag(flagSet[1].toLowerCase().trim());
      if (flagId) state.flags[flagId] = true;
    }

    const added = line.match(/Added to inventory:\s*(.+?)\]/i);
    if (added) {
      const itemId = inventoryLabelToId(added[1], world);
      if (itemId && !state.inventory.includes(itemId)) state.inventory.push(itemId);
    }

    if (line.toLowerCase().includes('floppy disk consumed')) {
      state.inventory = state.inventory.filter((i) => i !== 'floppy_disk');
    }
  }
}

function labelToFlag(label: string): string | null {
  // Hand-mapped friendly labels in the event scripts -> canonical flag IDs.
  const map: Record<string, string> = {
    'lumbergh has visited': 'lumbergh_visited',
    'took the stapler': 'took_stapler',
    hypnotized: 'hypnotized',
    'met the bobs': 'met_bobs',
    'met joanna': 'met_joanna',
    'has scheme': 'has_scheme',
    'virus installed': 'virus_installed',
    'printer destroyed': 'printer_destroyed',
    'alarm clock smashed': 'alarm_clock_smashed',
  };
  return map[label] ?? null;
}

function inventoryLabelToId(label: string, world: World): string | null {
  const normalized = label.trim().toLowerCase();
  for (const [id, item] of Object.entries(world.items)) {
    if (item.name.toLowerCase() === normalized) return id;
  }
  return null;
}

/** Lines emitted when entering a room (description, items, NPCs, exits). */
function describeRoom(roomId: string, world: World, state: GameState): string[] {
  const room = world.rooms[roomId];
  if (!room) return [`The world frays. Room "${roomId}" does not exist.`];
  const lines: string[] = [];
  lines.push(`📍 ${room.name}`);
  lines.push(room.description);

  const visibleItems = visibleItemsIn(roomId, world, state);
  if (visibleItems.length > 0) {
    const names = visibleItems.map((id) => world.items[id]?.name ?? id);
    lines.push(`You can see: ${names.join(', ')}.`);
  }

  if (room.npcs.length > 0) {
    const names = room.npcs.map((id) => world.npcs[id]?.name ?? id);
    lines.push(`Present: ${names.join(', ')}.`);
  }

  const exits = Object.keys(room.exits);
  if (exits.length > 0) {
    lines.push(`Exits: ${exits.join(', ')}.`);
  }
  return lines;
}

export function visibleItemsIn(roomId: string, world: World, state: GameState): string[] {
  const room = world.rooms[roomId];
  if (!room) return [];
  const removed = new Set(state.itemsRemoved[roomId] ?? []);
  const inInventory = new Set(state.inventory);
  const base = room.items.filter((i) => !removed.has(i) && !inInventory.has(i));
  const added = (state.itemsAdded[roomId] ?? []).filter((i) => !inInventory.has(i));
  return [...base, ...added];
}

/** Evaluate onEnter triggers and emit any event-script lines. */
function runOnEnter(roomId: string, world: World, state: GameState): string[] {
  const room = world.rooms[roomId];
  if (!room) return [];
  const out: string[] = [];
  for (const trigger of room.onEnter) {
    if (state.firedEvents.includes(trigger.then)) continue;
    if (evaluateCondition(trigger.if, state)) {
      out.push(...(world.events[trigger.then] ?? []));
      applyEventEffects(trigger.then, world, state);
      state.firedEvents.push(trigger.then);
    }
  }
  return out;
}

function enterRoom(targetId: string, world: World, state: GameState): string[] {
  const target = world.rooms[targetId];
  if (!target) return [`There is nothing in that direction.`];
  if (target.requires && !evaluateCondition(target.requires, state)) {
    return [denialFor(targetId)];
  }
  state.currentRoom = targetId;
  state.moveCount += 1;
  const lines = describeRoom(targetId, world, state);
  lines.push(...runOnEnter(targetId, world, state));
  return lines;
}

function denialFor(roomId: string): string {
  switch (roomId) {
    case 'apartment_post':
    case 'initech_lobby_post':
    case 'cubicle_farm_post':
    case 'your_cubicle_post':
    case 'break_room_post':
    case 'chotchkies':
    case 'chotchkies_bar':
    case 'bobs_office':
      return "You don't feel like you. Not yet. There is a metronome you should see first.";
    case 'server_room':
      return "The server room is locked. You'd need a reason to be in there. A reason and, perhaps, a disk.";
    case 'the_field':
      return "There's nothing for you in that field yet. Not without a plan, and a bat.";
    default:
      return "Something stops you. The story isn't ready for you to go there yet.";
  }
}

/* ------------------------------------------------------------------ */
/* Command handlers                                                    */
/* ------------------------------------------------------------------ */

function handleLook(world: World, state: GameState): EngineResult {
  return { lines: describeRoom(state.currentRoom, world, state), mutated: false };
}

function handleInventory(world: World, state: GameState): EngineResult {
  if (state.inventory.length === 0) {
    return { lines: ['Just the weight of corporate despair.'], mutated: false };
  }
  const lines = ['You are carrying:'];
  for (const id of state.inventory) {
    const item = world.items[id];
    lines.push(`  - ${item?.name ?? id}`);
  }
  return { lines, mutated: false };
}

function handleGo(target: string | undefined, world: World, state: GameState): EngineResult {
  if (!target) {
    return { lines: ['Go where? Try a direction or a place.'], mutated: false };
  }
  const room = world.rooms[state.currentRoom];
  if (!room) return { lines: ['You are nowhere.'], mutated: false };

  const exitKey = fuzzyMatchExit(target, room.exits);
  if (!exitKey) {
    const exits = Object.keys(room.exits).join(', ');
    return {
      lines: [`You can't go that way. Available exits: ${exits || '(none)'}.`],
      mutated: false,
    };
  }
  const destination = room.exits[exitKey];
  const lines = enterRoom(destination, world, state);
  return { lines, mutated: true };
}

function handleTake(target: string | undefined, world: World, state: GameState): EngineResult {
  if (!target) return { lines: ['Take what?'], mutated: false };
  const room = world.rooms[state.currentRoom];
  if (!room) return { lines: ['Nothing here to take.'], mutated: false };

  const visibleIds = visibleItemsIn(state.currentRoom, world, state);
  const candidates = visibleIds.map((id) => ({ id, name: world.items[id]?.name ?? id }));
  const itemId = fuzzyMatch(target, candidates);
  if (!itemId) {
    return { lines: [`You don't see a "${target}" here.`], mutated: false };
  }
  const item = world.items[itemId];
  if (!item) return { lines: ["That doesn't exist."], mutated: false };

  if (!item.portable) {
    return { lines: [nonPortableRefusal(itemId, item.name)], mutated: false };
  }

  state.inventory.push(itemId);
  const removed = state.itemsRemoved[state.currentRoom] ?? [];
  removed.push(itemId);
  state.itemsRemoved[state.currentRoom] = removed;

  const lines = [`Taken: ${item.name}.`];
  if (item.onTake && !state.firedEvents.includes(item.onTake)) {
    lines.push(...(world.events[item.onTake] ?? []));
    applyEventEffects(item.onTake, world, state);
    state.firedEvents.push(item.onTake);
  }
  return { lines, mutated: true };
}

function nonPortableRefusal(itemId: string, name: string): string {
  switch (itemId) {
    case 'printer':
      return 'The printer is bolted to the table, mocking you.';
    case 'alarm_clock':
      return 'The alarm clock is plugged in and beneath your dignity to unplug.';
    case 'metronome':
      return "Dr. Swanson's metronome. You feel like it should stay where it is.";
    case 'server_terminal':
      return 'You cannot exactly pocket a server. USE it instead.';
    default:
      return `You can't take the ${name}.`;
  }
}

function handleDrop(target: string | undefined, world: World, state: GameState): EngineResult {
  if (!target) return { lines: ['Drop what?'], mutated: false };
  const inv = state.inventory.map((id) => ({ id, name: world.items[id]?.name ?? id }));
  const itemId = fuzzyMatch(target, inv);
  if (!itemId) return { lines: [`You aren't carrying a "${target}".`], mutated: false };

  state.inventory = state.inventory.filter((i) => i !== itemId);
  const added = state.itemsAdded[state.currentRoom] ?? [];
  added.push(itemId);
  state.itemsAdded[state.currentRoom] = added;
  const removed = state.itemsRemoved[state.currentRoom] ?? [];
  state.itemsRemoved[state.currentRoom] = removed.filter((i) => i !== itemId);

  return { lines: [`Dropped: ${world.items[itemId]?.name ?? itemId}.`], mutated: true };
}

function handleExamine(target: string | undefined, world: World, state: GameState): EngineResult {
  if (!target) return { lines: ['Examine what?'], mutated: false };

  const visibleItemIds = visibleItemsIn(state.currentRoom, world, state);
  const inventoryIds = state.inventory;
  const npcIds = world.rooms[state.currentRoom]?.npcs ?? [];

  const itemCandidates = [...visibleItemIds, ...inventoryIds].map((id) => ({
    id,
    name: world.items[id]?.name ?? id,
  }));
  const matchedItem = fuzzyMatch(target, itemCandidates);
  if (matchedItem) {
    return {
      lines: [world.items[matchedItem]?.description ?? "It's nondescript."],
      mutated: false,
    };
  }

  const npcCandidates = npcIds.map((id) => ({ id, name: world.npcs[id]?.name ?? id }));
  const matchedNpc = fuzzyMatch(target, npcCandidates);
  if (matchedNpc) {
    return {
      lines: [world.npcs[matchedNpc]?.description ?? 'They look back at you.'],
      mutated: false,
    };
  }

  return { lines: [`You see no "${target}" here worth examining.`], mutated: false };
}

function handleUse(target: string | undefined, world: World, state: GameState): EngineResult {
  if (!target) return { lines: ['Use what?'], mutated: false };

  const visibleItemIds = visibleItemsIn(state.currentRoom, world, state);
  const inventoryIds = state.inventory;
  const candidates = [...visibleItemIds, ...inventoryIds].map((id) => ({
    id,
    name: world.items[id]?.name ?? id,
  }));
  const itemId = fuzzyMatch(target, candidates);
  if (!itemId) return { lines: [`There is no "${target}" here to use.`], mutated: false };

  if (itemId === 'server_terminal' && state.currentRoom === 'server_room') {
    if (!state.inventory.includes('floppy_disk')) {
      return {
        lines: ["The terminal is waiting for a disk. You don't have one."],
        mutated: false,
      };
    }
    if (state.firedEvents.includes('install_virus')) {
      return { lines: ['The terminal already shows: DONE.'], mutated: false };
    }
    const lines = [...(world.events.install_virus ?? [])];
    applyEventEffects('install_virus', world, state);
    state.firedEvents.push('install_virus');
    return { lines, mutated: true };
  }

  if (itemId === 'baseball_bat') {
    return {
      lines: ['You heft the bat. There must be something nearby that deserves it.'],
      mutated: false,
    };
  }

  if (itemId === 'hawaiian_shirt') {
    return handleWear('hawaiian shirt', world, state);
  }

  if (itemId === 'fish_fillet') {
    return { lines: ['You set the fish on the desk for later. The desk smells like commitment now.'], mutated: false };
  }

  return { lines: ["You can't see how to use that here."], mutated: false };
}

function handleWear(target: string | undefined, world: World, state: GameState): EngineResult {
  if (!target) return { lines: ['Wear what?'], mutated: false };
  const inv = state.inventory.map((id) => ({ id, name: world.items[id]?.name ?? id }));
  const itemId = fuzzyMatch(target, inv);
  if (!itemId) return { lines: [`You aren't carrying a "${target}".`], mutated: false };
  if (itemId === 'hawaiian_shirt') {
    state.flags.wearing_hawaiian = true;
    return {
      lines: ['You put on the Hawaiian shirt. You feel sixteen percent more liberated.'],
      mutated: true,
    };
  }
  return { lines: ['That is not really wearable.'], mutated: false };
}

function handleTalk(target: string | undefined, world: World, state: GameState): EngineResult {
  if (!target) return { lines: ['Talk to whom?'], mutated: false };
  const present = world.rooms[state.currentRoom]?.npcs ?? [];
  const candidates = present.map((id) => ({ id, name: world.npcs[id]?.name ?? id }));
  const npcId = fuzzyMatch(target, candidates);
  if (!npcId) {
    return { lines: [`There is no "${target}" here to talk to.`], mutated: false };
  }
  const dialogue = world.dialogue[npcId];
  if (!dialogue) return { lines: ['They have nothing to say.'], mutated: false };

  // Pick the most specific (last-matching) flag-gated line; fall back to default.
  let chosen = dialogue.default;
  for (const [key, value] of Object.entries(dialogue)) {
    if (key === 'default') continue;
    if (evaluateCondition(key, state)) chosen = value;
  }
  return { lines: [chosen], mutated: false };
}

function handleSmash(target: string | undefined, world: World, state: GameState): EngineResult {
  const visibleIds = visibleItemsIn(state.currentRoom, world, state);
  const candidates = [...visibleIds, ...state.inventory].map((id) => ({
    id,
    name: world.items[id]?.name ?? id,
  }));
  const itemId = target ? fuzzyMatch(target, candidates) : null;
  const item = itemId ? world.items[itemId] : null;

  const inEndingRoom =
    state.currentRoom === 'the_field' || state.currentRoom === 'break_room_post';
  const hasBat = state.inventory.includes('baseball_bat');

  // Printer ending — bat in hand in the right room. Same chain as before.
  if (itemId === 'printer' && inEndingRoom && hasBat) {
    if (state.flags.printer_destroyed) {
      return { lines: ['The printer is already in pieces. Some of it is in your hair.'], mutated: false };
    }
    const lines = [...(world.events.printer_smash ?? [])];
    applyEventEffects('printer_smash', world, state);
    state.firedEvents.push('printer_smash');
    lines.push(...(world.events.game_ending ?? []));
    applyEventEffects('game_ending', world, state);
    state.firedEvents.push('game_ending');
    state.gameOver = true;
    return { lines, mutated: true };
  }

  // Printer hand-hurt — anywhere the printer is, no bat. The printer is bolted
  // to the table; smashing with bare hands just hurts you. After the first try
  // we taunt instead of replaying the whole bit.
  if (itemId === 'printer') {
    if (state.flags.printer_hand_hurt) {
      return {
        lines: ['You ball your hand into a fist. It already hurts. The printer is winning.'],
        mutated: false,
      };
    }
    const lines = [...(world.events.printer_hand_hurt ?? [])];
    state.flags.printer_hand_hurt = true;
    return { lines, mutated: true };
  }

  // Generic onSmash hook — destructible items with their own one-shot event
  // (alarm clock etc.). Item is removed from the room afterward.
  if (item?.onSmash) {
    if (state.firedEvents.includes(item.onSmash)) {
      return { lines: [`The ${item.name} is already in pieces.`], mutated: false };
    }
    const lines = [...(world.events[item.onSmash] ?? [])];
    applyEventEffects(item.onSmash, world, state);
    state.firedEvents.push(item.onSmash);
    const removed = state.itemsRemoved[state.currentRoom] ?? [];
    if (itemId && !removed.includes(itemId)) removed.push(itemId);
    state.itemsRemoved[state.currentRoom] = removed;
    return { lines, mutated: true };
  }

  // Refusals.
  if (!inEndingRoom) {
    return { lines: ['Smashing things at work is, somehow, still frowned upon.'], mutated: false };
  }
  if (!hasBat) {
    return { lines: ['You would need something heavy. A bat, say.'], mutated: false };
  }
  if (target && !/printer|it|that/i.test(target)) {
    return { lines: [`You don't see a "${target}" worth smashing.`], mutated: false };
  }
  return { lines: ['Nothing happens.'], mutated: false };
}

function handleSnooze(world: World, state: GameState): EngineResult {
  // Find the first item in the current room that has an onSnooze hook.
  const visibleIds = visibleItemsIn(state.currentRoom, world, state);
  const snoozable = visibleIds
    .map((id) => ({ id, item: world.items[id] }))
    .find(({ item }) => item?.onSnooze);
  if (!snoozable || !snoozable.item?.onSnooze) {
    if (state.flags.alarm_clock_smashed && state.currentRoom === 'apartment_bedroom') {
      return {
        lines: [
          'You smashed the alarm clock. It is in pieces on the bedside table.',
          'You will probably oversleep tomorrow. This feels, on balance, fine.',
        ],
        mutated: false,
      };
    }
    return { lines: ['There is nothing here to snooze.'], mutated: false };
  }
  const lines = [...(world.events[snoozable.item.onSnooze] ?? [])];
  applyEventEffects(snoozable.item.onSnooze, world, state);
  return { lines, mutated: false };
}

function handleInstall(target: string | undefined, world: World, state: GameState): EngineResult {
  // INSTALL is an alias for USE on the server terminal.
  if (state.currentRoom !== 'server_room') {
    return { lines: ['There is nothing here to install onto.'], mutated: false };
  }
  return handleUse(target ?? 'server terminal', world, state);
}

function handleHelp(): EngineResult {
  return {
    lines: [
      '═══════ COMMANDS ═══════',
      'GO <direction|place>     N / S / E / W also work',
      'LOOK                     Re-describe the current location',
      'TAKE <item>              Pick up an item (synonyms: GET, GRAB)',
      'DROP <item>              Drop an item from your inventory',
      'EXAMINE <item|npc>       Inspect (synonyms: INSPECT, LOOK AT)',
      'USE <item>               Use an item in context',
      'WEAR <item>              Put on a wearable',
      'TALK TO <npc>            Speak with someone (synonyms: ASK)',
      'INVENTORY / I            List what you are carrying',
      'SMASH <target>           Apply violence',
      'SNOOZE                   Hit the snooze button (contextual)',
      'INSTALL <target>         Install (used on server terminal)',
      'SAVE                     Save progress to local terminal memory',
      'LOAD                     Restore last saved game',
      'RESTART                  Wipe save and start over',
      'HELP / ?                 This screen',
      '════════════════════════',
      'You can also just type what you want to do in plain English.',
    ],
    mutated: false,
  };
}

function handleGameOver(): EngineResult {
  return {
    lines: ['The game has ended. Type RESTART to play again.'],
    mutated: false,
  };
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

export function execute(
  action: ParsedAction,
  deps: EngineDeps,
): EngineResult {
  const { world, state } = deps;

  if (state.gameOver && action.action !== 'restart' && action.action !== 'help') {
    return handleGameOver();
  }

  switch (action.action) {
    case 'go':
      return handleGo(action.target, world, state);
    case 'look':
      return handleLook(world, state);
    case 'take':
      return handleTake(action.target, world, state);
    case 'drop':
      return handleDrop(action.target, world, state);
    case 'examine':
      return handleExamine(action.target, world, state);
    case 'use':
      return handleUse(action.target, world, state);
    case 'wear':
      return handleWear(action.target, world, state);
    case 'talk':
      return handleTalk(action.target, world, state);
    case 'inventory':
      return handleInventory(world, state);
    case 'smash':
      return handleSmash(action.target, world, state);
    case 'snooze':
      return handleSnooze(world, state);
    case 'install':
      return handleInstall(action.target, world, state);
    case 'help':
      return handleHelp();
    case 'sit':
    case 'wait':
      return { lines: ['Time passes. Initech does too.'], mutated: false };
    case 'quit':
      return { lines: ['You cannot quit. There are TPS reports.'], mutated: false };
    case 'restart':
      // RESTART is handled at the store layer (it clears persistence). Engine just signals.
      return { lines: ['[RESTART]'], mutated: false };
    case 'save':
    case 'load':
      // Handled at the store/persistence layer.
      return { lines: [`[${action.action.toUpperCase()}]`], mutated: false };
    default:
      return {
        lines: ["I don't understand that. Type HELP for commands, or try saying it differently."],
        mutated: false,
      };
  }
}

/** Compose the opening: intro lines + first room description. */
export function openingLines(world: World, state: GameState): string[] {
  const lines = [...(world.events.intro ?? [])];
  lines.push(...describeRoom(state.currentRoom, world, state));
  return lines;
}

export function describeCurrentRoom(world: World, state: GameState): string[] {
  return describeRoom(state.currentRoom, world, state);
}

/** Re-export internal helpers for test access. */
export const __test = { denialFor, enterRoom };
