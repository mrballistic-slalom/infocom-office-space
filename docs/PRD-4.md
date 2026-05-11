# PRD: INITECH TERMINAL — A Zork-Style Text Adventure Engine

## 1. Overview / Executive Summary

INITECH TERMINAL is a Zork-style interactive fiction engine that uses a lightweight LLM (Amazon Bedrock Haiku) to parse natural-language player input into structured game actions, while running all game logic as a deterministic state machine against a JSON-defined world. The first playable world is **Office Space** — a text adventure following the story beats of the 1999 Mike Judge film, from Peter Gibbons' Monday morning alarm through the printer destruction and Milton's arson epilogue.

The visual identity is a **faithful CRT terminal emulator** — not "retro-inspired" or "retro-flavored," but a committed phosphor-screen simulation with scanlines, bloom, barrel distortion, flicker, and amber-on-black typography. The interface should feel like you found a forgotten IBM 3278 in Initech's server room and it's running a text adventure someone wrote in 1987.

**Deployment target**: AWS us-west-2 via CDK

**Primary persona**: Todd Greco (developer/player) — this is a personal project and architecture proof-of-concept for an LLM-augmented interactive fiction engine. The Office Space world is the test payload; the engine is designed to accept any world JSON file.

---

## 2. Goals & Non-Goals

### Goals

- Prove the architecture: deterministic game engine + LLM intent parser + JSON world definition as three cleanly separated concerns
- Ship a fully playable Office Space text adventure covering all major story beats from the film (15+ rooms, 10+ items, 8+ NPCs, branching event scripts)
- Achieve a CRT terminal aesthetic convincing enough that a screenshot could be mistaken for actual hardware phosphor — including power-on sequence, phosphor persistence, screen flicker, typewriter text rendering, and barrel distortion
- Keep LLM latency below 2 seconds for intent parsing (Haiku-tier model via Bedrock)
- Make the world JSON schema clean enough that a separate world-builder tool (future project) can generate new worlds with zero engine changes
- Persist game state to browser localStorage so a player can close the tab and resume exactly where they left off
- Have fun — this is a personal project and should feel like it

### Non-Goals

- **No world-builder tool in this version** — worlds are hand-authored JSON files. A future LLM-powered authoring tool is anticipated but out of scope.
- **No multiplayer** — single player only
- **No mobile-optimized layout** — desktop-first CRT experience. Mobile can work but is not a design target.
- **No audio** — the CRT aesthetic is visual only. No sound effects, no music, no Geto Boys (yet).
- **No user accounts or authentication** — the app is a static SPA with a Lambda backend for LLM calls.
- **No generative room descriptions** — all text is authored in the world JSON. The LLM is used exclusively for intent parsing, never for content generation during gameplay.

---

## 3. User Stories / Personas

### Persona: The Player

**Role**: Someone who wants to play a text adventure set in the Office Space universe
**Context**: Sitting at a desktop browser, typing commands into a terminal-style interface
**Motivation**: Nostalgia (for both Infocom games and the film), entertainment, exploring an interactive retelling of the story

#### US-001: Start a New Game

> As a player, I want to see an atmospheric title screen and opening text when I load the app, so that I'm immediately immersed in the CRT terminal world.

**Acceptance criteria**:
- On first load (no saved state), the CRT power-on animation plays: screen warms up from black through a horizontal phosphor line expanding vertically, then amber color fades in over 1.5–2 seconds
- Title sequence renders after power-on completes, with CRT visual effects (scanlines, bloom, slight flicker)
- Game title "OFFICE SPACE: THE TEXT ADVENTURE" displays with ASCII-art styling
- Subtitle: "A Conditions-of-Employment Simulator"
- Terminal header shows "INITECH TERMINAL v4.02" and a move counter
- Opening chapter text ("CHAPTER 1: ANOTHER CASE OF THE MONDAYS") displays
- First room description (Peter's Bedroom) renders automatically with typewriter text animation
- Input prompt is focused and ready for typing after all intro text has rendered
- On subsequent loads with saved state, power-on animation still plays but is shorter (0.75s), then the game resumes from saved position with a "[Session restored]" message

#### US-002: Navigate the World

> As a player, I want to move between rooms using natural language or classic adventure commands, so that I can explore the Initech world.

**Acceptance criteria**:
- Classic commands work: `GO NORTH`, `N`, `EAST`, `ENTER LOBBY`, direction words alone
- Natural language works: "walk to the break room", "head over to the cubicles", "I want to go see Lumbergh"
- Room description, visible items, NPCs present, and available exits display on entry
- Gated exits display a contextual denial message (not a generic error) when conditions are unmet
- Invalid directions display available exits as a hint

#### US-003: Interact with Items

> As a player, I want to take, examine, use, and drop items, so that I can solve puzzles and advance the story.

**Acceptance criteria**:
- `TAKE [item]`, `EXAMINE [item]`, `USE [item]`, `DROP [item]` work with fuzzy matching against item names and IDs
- Non-portable items display a contextual refusal message (e.g., the printer: "bolted to the table, mocking you")
- Taking the red stapler triggers Milton's reaction event
- `INVENTORY` (or `I`) lists all carried items with descriptions
- Empty inventory displays a thematic message ("Just the weight of corporate despair")

#### US-004: Talk to NPCs

> As a player, I want to talk to characters from the film who respond with dialogue that changes based on story progression, so that the world feels alive and reactive.

**Acceptance criteria**:
- `TALK TO [NPC]` works with fuzzy name matching ("talk to michael", "talk to bolton", "ask lumbergh")
- Each NPC has a default dialogue line and 1+ flag-gated alternate lines
- Dialogue reflects current story state (e.g., Michael's dialogue changes after the scheme is hatched)
- Talking to a non-present NPC displays a contextual message, not a generic error

#### US-005: Experience the Story Arc

> As a player, I want to progress through the Office Space story beats in a guided but explorable order, so that it feels like playing through the movie.

**Acceptance criteria**:
- Story progresses through flag-gated events triggered by room entry or item interaction
- Chapter transitions display with visual emphasis ("✨ CHAPTER 2: THE LIBERATION")
- The critical path is: apartment → commute → Initech → cubicle (Lumbergh TPS scene) → hypnotherapist → liberated world → Bobs meeting → scheme pitch → virus install → printer destruction → epilogue
- Side content (Chotchkie's, Joanna, exploring Lumbergh's office) is accessible but not required
- Game ending (epilogue) displays a full narrative wrap-up and "Type RESTART to play again"

#### US-006: Use Natural Language

> As a player, I want to type conversational English and have it understood, so that I don't have to memorize command syntax.

**Acceptance criteria**:
- Common commands (go, take, look, inventory, talk, examine, use, help) are parsed by a fast regex-based fallback parser with zero latency
- Ambiguous or conversational input ("maybe I should see that therapist", "I want to tell Lumbergh to shove it") falls through to the LLM intent parser
- LLM parser receives current room context (exits, items, NPCs, inventory) in its system prompt
- LLM parser returns structured JSON: `{ "action": "verb", "target": "noun" }`
- A "[parsing...]" indicator displays while the LLM call is in flight
- If the LLM call fails or times out (>5s), a graceful fallback message displays suggesting the player rephrase or use `HELP`

#### US-007: Persistent Game State

> As a player, I want my progress saved automatically so that I can close the browser and pick up where I left off.

**Acceptance criteria**:
- Game state (current room, inventory, flags, move count, output history) auto-saves to `localStorage` after every successful command
- On page load, if a saved state exists, the game resumes from that state: current room re-describes, inventory intact, all flags preserved, output history restored
- A "[Session restored — type LOOK to re-orient]" message displays on resume
- The `RESTART` command clears the saved state from `localStorage` and begins a fresh game
- A `SAVE` command explicitly saves and confirms: "Progress saved to local terminal memory."
- A `LOAD` command explicitly loads from the last save point and confirms
- If `localStorage` is unavailable (private browsing, storage full), the game functions normally without persistence and displays no error — persistence is a silent enhancement
- Saved state uses a namespaced key: `initech-terminal:save`

#### US-008: CRT Visual Immersion

> As a player, I want the terminal to look and feel like a real CRT monitor, so that the aesthetic is a core part of the experience, not a skin.

**Acceptance criteria**:
- Power-on animation plays on every fresh page load: black screen → horizontal phosphor line → vertical expansion → full amber display (1.5–2 seconds)
- Text renders with a typewriter effect: characters appear sequentially at approximately 15–25ms per character
- Typewriter effect is skippable: pressing any key or clicking instantly renders all pending text
- Screen has a subtle, irregular flicker: brightness oscillates between 0.96 and 1.0 on overlapping non-rhythmic animation cycles
- Scanlines are visible across the entire viewport at all times
- Phosphor bloom (soft amber glow) radiates from the center of the screen
- A subtle vignette darkens the edges and corners, simulating CRT barrel curvature
- Text has a soft amber glow (text-shadow) simulating phosphor persistence
- When new text appears, previously rendered lines have a very slight dimming compared to the newest line, simulating phosphor decay
- Room name lines (`📍`) render with a brighter glow and slightly larger font to create hierarchy
- The cursor in the input field blinks with a CRT-appropriate duty cycle (500ms on, 500ms off, square wave, not sinusoidal)

---

## 4. Functional Requirements

### Game Engine (Deterministic State Machine)

**FR-001**: The game engine shall maintain a state object containing: `currentRoom` (string, room ID), `inventory` (string array, item IDs), `flags` (object, string keys to boolean values), `moveCount` (integer), `gameOver` (boolean), and `outputHistory` (array of output line objects for session replay on restore).

**FR-002**: On room entry, the engine shall: (a) display the room name with a 📍 prefix, (b) display the room description, (c) list visible items (excluding items already in inventory or removed by flags), (d) list NPCs present, (e) list available exits.

**FR-003**: On room entry, the engine shall evaluate the room's `onEnter` event array. Each event has an `if` condition string and a `then` event key. Conditions support: `flag:NAME` (flag is true), `!flag:NAME` (flag is false), `has:ITEM` (item in inventory), `!has:ITEM` (item not in inventory). If the condition evaluates to true, the engine shall execute the event script and set any associated flags.

**FR-004**: Event scripts shall be defined as arrays of strings in an `EVENTS` object, keyed by event ID. The engine renders each string as a separate output line. Events may set flags, add items to inventory, or transition the game to a new room.

**FR-005**: Room exits shall support an optional `requires` field (string, format `flag:NAME`). If the requirement is not met, the engine shall display a contextual denial message and remain in the current room.

**FR-006**: The `moveCount` shall increment by 1 on every successful room transition and display in the terminal header.

**FR-007**: When `gameOver` is true, the engine shall reject all input except `RESTART`. The `RESTART` command shall clear the saved state from `localStorage` (key: `initech-terminal:save`), reset the state object to its initial values, play the CRT power-on animation (abbreviated, 0.75s), and re-render the title sequence and first room.

**FR-008**: The `HELP` command shall display a formatted command reference showing all available verbs, their syntax, and aliases. The `SAVE` and `LOAD` commands shall be listed in the help text.

### Session Persistence (localStorage)

**FR-008a**: After every successful command execution (any command that modifies game state), the engine shall serialize the current `GameState` object (including `outputHistory` — the last 500 output lines) to `localStorage` under the key `initech-terminal:save`. Serialization format: `JSON.stringify`.

**FR-008b**: On application load, the engine shall attempt to read `initech-terminal:save` from `localStorage`. If a valid saved state exists and can be parsed, the engine shall restore: `currentRoom`, `inventory`, `flags`, `moveCount`, `gameOver`, and `outputHistory`. The output area shall be populated with the restored `outputHistory` (no typewriter effect on restored lines — they render instantly). A system message shall display: "[Session restored — type LOOK to re-orient]". The input prompt shall then focus.

**FR-008c**: If `localStorage` is unavailable (private browsing mode, storage quota exceeded, or browser restriction), the engine shall silently fall back to in-memory-only state. No error message shall display. The `SAVE` command shall respond: "Local terminal memory is unavailable in this browser mode. Progress will not persist across sessions."

**FR-008d**: The `SAVE` command shall explicitly trigger a save and display: "Progress saved to local terminal memory." The `LOAD` command shall reload from the last saved state and display: "[Session restored from local terminal memory]" followed by the current room description.

**FR-008e**: The `RESTART` command shall call `localStorage.removeItem('initech-terminal:save')` before resetting state, ensuring a clean start on next load.

**FR-008f**: The saved state shall include a `version` field (string, initial value: `"1.0"`). On load, if the saved version does not match the current engine version, the saved state shall be discarded and a fresh game started. This prevents state corruption across world schema changes.

**FR-008g**: The `outputHistory` stored in `localStorage` shall be capped at the most recent 500 lines. Older lines are discarded on save. This prevents `localStorage` quota exhaustion over long play sessions.

### Intent Parser (Hybrid: Regex + LLM)

**FR-009**: The fallback regex parser shall handle the following command patterns with zero external calls:
- Movement: `GO [direction]`, `NORTH/SOUTH/EAST/WEST`, `N/S/E/W`, `ENTER [place]`, `DRIVE`, `LEAVE`, direction words alone
- Items: `TAKE/GET/GRAB [item]`, `DROP [item]`, `EXAMINE/INSPECT/LOOK AT [item]`, `USE [item]`, `WEAR [item]`
- NPCs: `TALK TO [npc]`, `ASK [npc]`
- Info: `LOOK`, `INVENTORY/I`, `HELP/?`
- Special: `SMASH [target]`, `INSTALL [target]`
- Meta: `RESTART`, `QUIT`, `SAVE`, `LOAD`

**FR-010**: If the fallback parser returns null (no regex match), the engine shall call the LLM intent parser. The engine shall display a "[parsing...]" indicator during the API call.

**FR-011**: The LLM intent parser shall send a request to the Bedrock inference profile for Haiku (`us.anthropic.claude-haiku-4-5`) with:
- A system prompt containing: available action verbs, current room name, available exits, visible items, NPCs present, and player inventory
- The player's raw input as the user message
- `max_tokens: 150` (intent parsing requires minimal output)
- Response format instruction: "Respond with ONLY a JSON object: `{\"action\": \"verb\", \"target\": \"noun_or_direction\"}`"

**FR-012**: The LLM response shall be parsed as JSON. If parsing fails or the API call errors/times out (>5 seconds), the engine shall return `{ action: "unknown" }` and display: "I don't understand that. Type HELP for commands, or try saying it differently."

**FR-013**: All parsed actions (from either parser) shall pass through a fuzzy matching layer before execution. Fuzzy matching shall: (a) try exact match against IDs, (b) try partial string match, (c) try word-overlap match for inputs longer than 2 characters. This applies to item IDs, NPC IDs, and exit keys.

### World JSON Schema

**FR-014**: The world definition shall be a single JSON object (or TypeScript module exporting an object) with three top-level keys: `rooms`, `items`, and `npcs`.

**FR-015**: Each room shall conform to this interface:

```typescript
interface Room {
  name: string;                          // Display name
  description: string;                   // Full prose description shown on entry
  exits: Record<string, string>;         // key = exit label, value = destination room ID
  items: string[];                       // Item IDs present in this room at game start
  npcs: string[];                        // NPC IDs present in this room
  onEnter: EventTrigger[];               // Events to evaluate on room entry
  requires?: string;                     // Optional gate condition (format: "flag:NAME")
}

interface EventTrigger {
  if: string;                            // Condition: "flag:NAME", "!flag:NAME", "has:ITEM", "!has:ITEM"
  then: string;                          // Event script key to execute if condition is true
}
```

**FR-016**: Each item shall conform to this interface:

```typescript
interface Item {
  name: string;                          // Display name (human-readable)
  description: string;                   // Prose shown on EXAMINE
  portable: boolean;                     // Whether the player can TAKE this item
  tags: string[];                        // Semantic tags: "quest", "weapon", "wearable", etc.
  onTake?: string;                       // Optional event script key triggered when taken
}
```

**FR-017**: Each NPC shall conform to this interface:

```typescript
interface NPC {
  name: string;                          // Display name
  description: string;                   // Prose shown on EXAMINE
}
```

**FR-018**: NPC dialogue shall be defined in a separate `NPC_DIALOGUE` object, keyed by NPC ID. Each entry is an object with a `default` string and zero or more flag-gated overrides keyed as `"flag:NAME"`. The engine selects the most specific matching dialogue line.

**FR-019**: Event scripts shall be defined in an `EVENTS` object, keyed by event ID. Each value is a `string[]` rendered line-by-line. Event scripts may include emoji prefixes for visual emphasis and bracketed system messages (e.g., `[Flag set: Lumbergh has visited]`) for player feedback.

### Office Space World Content

**FR-020**: The Office Space world shall include the following rooms (minimum — additional rooms may be added):

| Room ID | Name | Story Beat |
|---|---|---|
| `apartment_bedroom` | Peter's Bedroom | Opening — alarm clock, Monday morning |
| `apartment_living` | Peter's Living Room | Wallet, keys, front door |
| `parking_lot` | Apartment Parking Lot | Car, drive to work or hypnotherapist |
| `commute` | The Commute | Traffic, lane-switching gag |
| `commute_worse` | The Commute (Worse Lane) | Lane switch backfires, old man with walker |
| `initech_parking` | Initech Parking Lot | Arrival at work |
| `initech_lobby` | Initech Lobby | Motivational posters, hub room |
| `cubicle_farm` | The Cubicle Farm | Michael, Samir, access to cubicle/Lumbergh/server |
| `your_cubicle` | Your Cubicle | TPS reports, Lumbergh visit event triggers here |
| `lumbergh_hallway` | Outside Lumbergh's Office | Glass office, coffee mug |
| `lumbergh_office` | Lumbergh's Office | Corner office, putting green, Porsche view |
| `break_room` | The Break Room | Milton, printer (PC LOAD LETTER), stale coffee |
| `hypnotherapist` | Dr. Swanson's Office | Hypnosis event — unlocks Chapter 2 |
| `parking_lot_post` | Parking Lot (After Hypnosis) | Hub to liberated world |
| `apartment_post` | Peter's Apartment (Liberated) | Hawaiian shirt, fish fillet, Channel 9 |
| `initech_lobby_post` | Initech Lobby (New Peter) | Access to Bobs, post-hypnosis cubicle farm |
| `bobs_office` | The Bobs' Consulting Room | "What would you say you DO here?" event |
| `chotchkies` | Chotchkie's Restaurant | Flair, Joanna |
| `chotchkies_bar` | Chotchkie's Bar | Joanna connection scene |
| `cubicle_farm_post` | The Cubicle Farm (New Attitude) | Scheme pitch event triggers here |
| `your_cubicle_post` | Your Cubicle (Liberated) | Gutting fish, dismantled wall |
| `break_room_post` | The Break Room (Reckoning) | Printer confrontation |
| `server_room` | Initech Server Room | Virus installation |
| `the_field` | An Open Field | Printer destruction climax |
| `ending` | Epilogue | Narrative ending, restart prompt |

**FR-021**: The Office Space world shall include the following items (minimum):

| Item ID | Name | Portable | Location | Purpose |
|---|---|---|---|---|
| `alarm_clock` | alarm clock | No | apartment_bedroom | Flavor |
| `apartment_key` | apartment key | Yes | apartment_living | Flavor/inventory |
| `wallet` | wallet | Yes | apartment_living | Flavor/inventory |
| `tps_reports` | TPS reports | Yes | your_cubicle | Quest — Lumbergh scene |
| `red_stapler` | red Swingline stapler | Yes | your_cubicle | Quest — Milton event trigger |
| `printer` | printer | No | break_room, break_room_post | Flavor — smash target |
| `stale_coffee` | stale coffee | Yes | break_room | Flavor |
| `lumberghs_mug` | Lumbergh's coffee mug | Yes | lumbergh_office | Flavor |
| `metronome` | metronome | No | hypnotherapist | Flavor |
| `hawaiian_shirt` | Hawaiian shirt | Yes | apartment_post | Wearable — liberation symbol |
| `fish_fillet` | fish fillet | Yes | apartment_post | Flavor — gutting at desk |
| `piece_of_flair` | piece of flair | Yes | chotchkies | Flavor |
| `server_terminal` | server terminal | No | server_room | Use target — virus install |
| `floppy_disk` | floppy disk | Yes | (given by Michael) | Quest — virus delivery |
| `baseball_bat` | baseball bat | Yes | (given by Michael) | Quest — printer destruction |

**FR-022**: The Office Space world shall include the following NPCs:

| NPC ID | Name | Locations |
|---|---|---|
| `michael_bolton` | Michael Bolton | cubicle_farm, cubicle_farm_post, the_field |
| `samir` | Samir Nagheenanajar | cubicle_farm, cubicle_farm_post, the_field |
| `lumbergh` | Bill Lumbergh | lumbergh_hallway, lumbergh_office |
| `milton` | Milton Waddams | break_room, break_room_post |
| `dr_swanson` | Dr. Swanson | hypnotherapist |
| `joanna` | Joanna | chotchkies, chotchkies_bar |
| `bob_slydell` | Bob Slydell | bobs_office |
| `bob_porter` | Bob Porter | bobs_office |

**FR-023**: The Office Space world shall include the following scripted events:

| Event ID | Trigger | Story Beat | Flags Set |
|---|---|---|---|
| `lumbergh_tps` | Enter your_cubicle (first time) | Lumbergh appears, asks about TPS reports and Saturday | `lumbergh_visited` |
| `milton_stapler` | Take red_stapler | Milton panics about his stapler | `took_stapler` |
| `hypnosis_scene` | Enter hypnotherapist (first time) | Full hypnosis sequence, Dr. Swanson collapses, Peter is liberated | `hypnotized` |
| `bobs_meeting` | Enter bobs_office (first time) | "What would you say you DO here?" — Peter's honesty impresses the Bobs | `met_bobs` |
| `joanna_scene` | Enter chotchkies_bar (first time) | Peter and Joanna connect over minimum flair | `met_joanna` |
| `scheme_pitch` | Enter cubicle_farm_post (after met_bobs, before has_scheme) | Michael proposes the Superman III virus scheme, gives floppy disk and bat | `has_scheme` (also adds `floppy_disk` and `baseball_bat` to inventory) |
| `install_virus` | Use server_terminal with floppy_disk in inventory | Virus installs, decimal point error foreshadowed | `virus_installed` (removes `floppy_disk` from inventory) |
| `printer_smash` | SMASH in the_field or break_room_post with baseball_bat | Full printer destruction sequence with Geto Boys reference | `printer_destroyed` |
| `game_ending` | Triggered after printer_smash | Full epilogue: money panic, Milton's fire, Peter in construction, everyone's fate | Sets `gameOver` |

**FR-024**: The critical path shall gate progression as follows:
- Rooms with `_post` suffix require `flag:hypnotized`
- `server_room` requires `flag:has_scheme`
- `the_field` requires `flag:has_scheme`
- The scheme pitch event requires both `flag:met_bobs` and `!flag:has_scheme`
- Virus installation requires `floppy_disk` in inventory
- Printer destruction requires `baseball_bat` in inventory

### CRT Terminal Visual System

**FR-025**: The application shall render inside a full-viewport container with background color `#0a0a08` (near-black with warm undertone). All visual effects are layered using CSS, with no canvas or WebGL required.

**FR-026**: **Scanline overlay** — A full-screen pseudo-element shall render horizontal scanlines using `repeating-linear-gradient`: alternating 2px transparent / 2px `rgba(0,0,0,0.15)` bands. This layer sits above all content with `pointer-events: none`.

**FR-027**: **Phosphor bloom** — A radial gradient overlay centered on the viewport shall simulate the ambient glow of a CRT phosphor: `radial-gradient(ellipse at center, rgba(255,176,0,0.03) 0%, transparent 70%)`. This layer sits below content but above the background.

**FR-028**: **Barrel distortion (CRT curvature)** — The main content area shall have a subtle CSS barrel distortion effect. Implementation: apply a slight `perspective` transform or use a vignette gradient that darkens the corners to simulate the curvature of a CRT screen. The effect shall be subtle — suggesting curvature, not replicating a fishbowl.

**FR-029**: **Screen flicker** — Multiple overlapping CSS animations shall create an organic, non-rhythmic CRT flicker effect on the terminal container:
- **Base flicker**: `opacity` oscillating between `0.96` and `1.0` on a 3.7-second cycle (`ease-in-out`)
- **Secondary flicker**: `opacity` oscillating between `0.98` and `1.0` on a 2.3-second cycle (`ease-in-out`)
- **Micro-glitch**: Every 15–30 seconds (randomized via JS `setTimeout`), a single-frame brightness spike occurs — `opacity` jumps to `1.05` for 50ms then returns to normal. This simulates the occasional CRT voltage fluctuation.
- The three flicker layers combine multiplicatively (nested containers or CSS `filter: brightness()` animations at different rates). The result should feel alive but not distracting — if the player consciously notices the flicker, it's too strong.

**FR-030**: **Text rendering** — All game text shall use the `VT323` Google Font (loaded via `@import` or `<link>`) at 18px for body text and 20px for room names. Fallback: `'Courier New', monospace`. Text color is `#FFB000` (CRT amber). Text shall have `text-shadow: 0 0 8px rgba(255,176,0,0.3)` to simulate phosphor persistence/glow.

**FR-031**: **Color system** — Define as CSS custom properties on `:root`:

```css
:root {
  /* Core palette */
  --crt-bg: #0a0a08;
  --crt-amber: #FFB000;
  --crt-amber-bright: #FFC833;
  --crt-amber-dim: rgba(255, 176, 0, 0.6);
  --crt-amber-glow: rgba(255, 176, 0, 0.3);
  --crt-amber-glow-strong: rgba(255, 176, 0, 0.6);
  --crt-green: #88FFaa;
  --crt-orange: #FF8844;
  --crt-gold: #FFD866;
  --crt-border: #332800;
  --crt-scanline: rgba(0, 0, 0, 0.15);

  /* Phosphor decay levels */
  --crt-decay-fresh: 1.0;               /* Lines 1–5 (most recent) */
  --crt-decay-recent: 0.92;             /* Lines 6–20 */
  --crt-decay-old: 0.85;                /* Lines 21+ */

  /* Boot sequence */
  --crt-boot-line: #FFD866;             /* Initial phosphor line color */
  --crt-boot-flash: #FFFFFF;            /* Stabilization flash */
  --crt-boot-duration: 2000ms;          /* Full boot (1500ms for cold, halved for restore) */

  /* Typewriter timing */
  --crt-type-fast: 10ms;                /* Room descriptions */
  --crt-type-normal: 18ms;              /* Event scripts */
  --crt-type-medium: 12ms;              /* Decorative lines */
  --crt-type-line-pause: 150ms;         /* Pause between lines in a batch */

  /* Flicker */
  --crt-flicker-base: 3.7s;             /* Primary flicker cycle */
  --crt-flicker-secondary: 2.3s;        /* Secondary flicker cycle */
  --crt-glitch-interval-min: 15s;       /* Micro-glitch minimum interval */
  --crt-glitch-interval-max: 30s;       /* Micro-glitch maximum interval */
}
```

**FR-032**: **Line styling by content type** — Output lines shall be styled based on their content:

| Content Type | Detection | Color | Additional Styling |
|---|---|---|---|
| Player input echo | Starts with `> ` | `--crt-green` | Instant render (no typewriter) |
| Room name | Starts with `📍` | `--crt-amber-bright` | 20px, bold, stronger glow, fast typewriter (10ms) |
| Event/script text | Starts with emoji (💼🌀👔💕💻💾🔨💥📎✨) | `--crt-orange` | Italic, orange glow, standard typewriter (18ms) |
| Title/decorative | Starts with `═` or `"` | `--crt-gold` | Medium typewriter (12ms) |
| System message | Starts with `[` | `--crt-amber-dim` | Instant render (no typewriter) |
| Standard prose | Everything else | `--crt-amber` | Standard glow, fast typewriter (10ms) |

**FR-033**: **Terminal header** — A fixed header bar shall display at the top of the viewport with: "INITECH TERMINAL v4.02" on the left and "MOVES: {moveCount}" on the right. Styled with `--crt-amber` at 60% opacity, 14px, uppercase, 2px letter-spacing. Separated from content by a 1px `--crt-border` line.

**FR-034**: **Input area** — A fixed input bar at the bottom of the viewport with: an amber `>` prompt character, a text input field with no visible border/background (transparent), green text color (`--crt-green`), VT323 font, amber caret. Placeholder text "What do you do?" in `--crt-amber` at 30% opacity. Separated from content by a 1px `--crt-border` line.

**FR-035**: **Scrollbar styling** — Custom scrollbar: 6px width, `--crt-bg` track, `--crt-border` thumb, 3px border-radius.

**FR-036**: **Typewriter effect** — All new output lines shall render character-by-character at a base rate of 18ms per character, simulating a terminal printing text. Implementation details:
- Each output line enters a render queue and plays sequentially (line N+1 begins after line N completes)
- Multi-line event scripts (e.g., the hypnosis scene, printer smash) play their full sequence with a 150ms pause between lines
- The effect is skippable: pressing any key, clicking the output area, or pressing Enter on an empty input instantly renders all queued text and returns control to the player
- Room descriptions (the initial block on room entry: name + description + items + NPCs + exits) render at a faster rate of 10ms per character to keep navigation snappy
- Player input echoes (lines starting with `> `) render instantly with no typewriter effect
- System messages (lines starting with `[`) render instantly
- When restoring from `localStorage`, all restored `outputHistory` lines render instantly (no typewriter replay)
- The typewriter queue shall be implemented as a Vue composable (`useTypewriter`) that exposes: `enqueue(lines: string[])`, `flush()` (instant render), `isTyping` (reactive boolean), and `renderedLines` (reactive array)

**FR-037**: **CRT power-on animation** — On page load, the terminal shall play a boot-up sequence simulating a CRT monitor warming up. This is a required feature, not a stretch goal. Implementation:

Phase 1 (0ms–400ms): **Ignition** — The entire viewport is black (`#000`). At 100ms, a single horizontal line of amber light (1px tall, 60% viewport width, centered) fades in over 300ms. This simulates the electron gun firing.

Phase 2 (400ms–900ms): **Vertical expansion** — The horizontal line expands vertically to fill the viewport. The expansion eases out (fast start, slow finish). The amber light is initially bright (`#FFD866`) and shifts to the standard amber (`#FFB000`) as it expands. Scanlines become visible during this phase.

Phase 3 (900ms–1500ms): **Stabilization** — A brief brightness surge (opacity 1.2 via CSS filter, clamped) then settle to normal. The phosphor bloom fades in. A subtle screen shake (1–2px random translate, 3 cycles) simulates the CRT stabilizing. The terminal header fades in.

Phase 4 (1500ms–2000ms): **Content** — The title sequence text begins typewriting in. The input bar fades in and focuses.

On session restore (saved state exists):
- Phases 1–2 play at 2x speed (total 450ms instead of 900ms)
- Phase 3 is skipped
- Phase 4 renders restored output instantly (no typewriter), then shows the "[Session restored]" message

The entire power-on sequence shall be implemented as a Vue component (`CrtBootSequence`) that emits a `@complete` event when finished. The game terminal is hidden (`v-if="bootComplete"`) until boot completes.

**FR-038**: **Phosphor persistence / text decay** — Older output lines shall have a subtly reduced glow compared to the most recently rendered lines, simulating phosphor decay on a CRT. Implementation:
- The 5 most recently rendered lines shall have full brightness (`opacity: 1.0`, full text-shadow glow)
- Lines 6–20 shall have `opacity: 0.92` and reduced glow (`text-shadow` alpha reduced to 0.2)
- Lines 21+ shall have `opacity: 0.85` and minimal glow (`text-shadow` alpha reduced to 0.1)
- When the player scrolls up to read earlier output, all visible lines temporarily restore to `opacity: 0.92` for readability, then decay again when the player scrolls back to the bottom
- Decay classes shall be applied via a computed property that recalculates on every output update

**FR-039**: **Event emphasis effects** — Major story events shall have enhanced visual feedback beyond text color:
- Chapter transitions (lines containing "CHAPTER") shall render with a brief screen-wide flash: `opacity` spikes to `1.1` for 100ms then returns to normal
- The printer smash sequence (lines starting with `💥`) shall apply a screen shake effect: 2px random translate on the terminal container, one shake per `💥` line, 80ms duration each
- The hypnosis event shall apply a brief horizontal screen warp: a CSS animation that subtly skews the content 0.5° left and right over 2 seconds, playing once, simulating disorientation
- The game ending title block (`═══` lines) shall render with a slow amber pulse: `text-shadow` glow oscillating between 0.3 and 0.6 alpha over 3 seconds, looping

**FR-040**: **Input cursor styling** — The text input caret shall be styled as a block cursor (full character width, amber color) that blinks with a square-wave duty cycle: 500ms visible, 500ms hidden, no easing. Implementation: hide the native caret (`caret-color: transparent`) and render a custom `::after` pseudo-element or a positioned `<span>` that toggles visibility on a 1-second `step-end` animation. The block cursor shall be the width of one VT323 character (approximately 10px at 18px font size).

**FR-041**: **Ambient CRT noise** (subtle) — A very faint noise texture shall overlay the entire terminal, simulating the slight visual noise of a CRT signal. Implementation: a full-viewport pseudo-element with a CSS `background-image` using a small (4x4px) inline SVG or data-URI noise pattern, tiled, at 2–3% opacity. The noise pattern shall shift position by 1px on a slow animation cycle (10+ seconds) to avoid appearing static. This effect must not degrade scroll performance — use `will-change: transform` and GPU compositing.

---

## 5. Technical Requirements / Stack

### Frontend

- **Vue 3** + TypeScript (Composition API, `<script setup>`)
- **Vuetify 3** — used minimally. The CRT aesthetic is custom CSS, not Material Design. Vuetify provides the app shell, layout scaffolding, and any utility components (e.g., `v-text-field` for input), but all visual styling is overridden to match the CRT theme. No default Vuetify colors, shadows, or typography shall be visible.
- **Pinia** for game state management (current room, inventory, flags, move count, game over, output history, localStorage persistence via a `PersistenceService` composable)
- **Vue Router** — single route. Router is included for future expandability (e.g., `/play/:worldId`) but v1 has one route.

### Backend / Infrastructure

- **AWS CDK** (TypeScript) for all infrastructure
- **Amazon API Gateway** (HTTP API) — single endpoint for intent parsing
- **AWS Lambda** (TypeScript, Node.js 20 runtime) — intent parser function
- **No database** — game state is client-side only. No DynamoDB, no S3 data storage.
- **S3 + CloudFront** for SPA hosting (static Vue build)

### AI / LLM

- **Amazon Bedrock** — Claude Haiku via inference profile `us.anthropic.claude-haiku-4-5`
- **Use case**: Intent parsing only — converting natural language player input to structured game actions
- **No RAG** — no knowledge bases, no vector stores, no retrieval
- **No content generation** — the LLM never writes room descriptions, dialogue, or story content during gameplay

⚠️ DEVIATION: Vuetify is present but serves as scaffolding only — the CRT visual system is entirely custom CSS. Do not apply Vuetify theme colors or default component styles to any game-facing UI elements.

---

## 6. API / Data Model

### API Endpoints

#### POST `/api/parse-intent`

Parse natural language player input into a structured game action.

**Request**:

```typescript
interface ParseIntentRequest {
  input: string;                         // Raw player input text
  context: {
    roomName: string;                    // Current room display name
    exits: string[];                     // Available exit labels
    items: string[];                     // Visible item display names
    npcs: string[];                      // Present NPC display names
    inventory: string[];                 // Player's inventory item display names
  };
}
```

**Response (200)**:

```typescript
interface ParseIntentResponse {
  action: string;                        // One of: go, take, drop, use, examine, look, talk, inventory, smash, wear, install, sit, wait, help, restart, quit, unknown
  target?: string;                       // Target noun (snake_case identifier or direction label)
}
```

**Response (400)**:

```typescript
interface ErrorResponse {
  error: string;                         // "Missing required field: input" or "Missing required field: context"
}
```

**Response (500)**:

```typescript
interface ErrorResponse {
  error: string;                         // "Intent parsing failed"
  fallback: { action: "unknown" };       // Always return a usable fallback
}
```

**Implementation notes**:
- Lambda timeout: 10 seconds
- Bedrock call timeout: 5 seconds (fail fast to keep gameplay responsive)
- System prompt for Bedrock call is constructed dynamically from the request context
- Response is parsed as JSON; if JSON parsing fails, return `{ action: "unknown" }`
- The Lambda shall strip markdown code fences (` ```json `) from the LLM response before parsing

### Data Model

There is no server-side data store. All data models are TypeScript interfaces in the frontend codebase. Game state persists to `localStorage` on the client.

#### World Definition Types

```typescript
interface World {
  rooms: Record<string, Room>;
  items: Record<string, Item>;
  npcs: Record<string, NPC>;
}

interface Room {
  name: string;
  description: string;
  exits: Record<string, string>;         // label → room ID
  items: string[];                       // item IDs
  npcs: string[];                        // NPC IDs
  onEnter: EventTrigger[];
  requires?: string;                     // "flag:NAME"
}

interface EventTrigger {
  if: string;                            // "flag:NAME", "!flag:NAME", "has:ITEM", "!has:ITEM"
  then: string;                          // event script key
}

interface Item {
  name: string;
  description: string;
  portable: boolean;
  tags: string[];
  onTake?: string;                       // event script key
}

interface NPC {
  name: string;
  description: string;
}

interface NPCDialogue {
  default: string;
  [flagCondition: string]: string;       // "flag:NAME" → dialogue override
}

type EventScripts = Record<string, string[]>;  // event key → lines of text
type DialogueMap = Record<string, NPCDialogue>;  // NPC ID → dialogue
```

#### Game State Types

```typescript
interface GameState {
  currentRoom: string;                   // Room ID
  inventory: string[];                   // Item IDs
  flags: Record<string, boolean>;        // Story progression flags
  moveCount: number;
  gameOver: boolean;
}

interface OutputLine {
  id: string;                            // Unique ID for Vue v-for key
  text: string;                          // Display text
  timestamp: number;                     // Render timestamp for typewriter sequencing
  type: OutputLineType;                  // Content classification for styling
}

type OutputLineType =
  | 'input'          // Player input echo (starts with "> ")
  | 'location'       // Room name (starts with "📍")
  | 'event'          // Event/script text (starts with emoji)
  | 'decorative'     // Title/border lines (starts with "═" or '"')
  | 'system'         // System messages (starts with "[")
  | 'prose';         // Standard prose (everything else)

interface ParsedAction {
  action: string;
  target?: string;
}
```

#### Persistence Types (localStorage)

```typescript
interface SavedState {
  version: string;                       // Schema version, e.g. "1.0"
  savedAt: string;                       // ISO 8601 timestamp of last save
  gameState: GameState;                  // Full game state snapshot
  outputHistory: OutputLine[];           // Last 500 output lines (capped on save)
}

// localStorage key
const SAVE_KEY = 'initech-terminal:save' as const;

// Current schema version — increment on breaking world/state changes
const SAVE_VERSION = '1.0' as const;
```

#### Persistence Utilities (Pinia store or composable)

```typescript
interface PersistenceService {
  save(state: GameState, outputHistory: OutputLine[]): void;   // Serialize to localStorage
  load(): SavedState | null;                                    // Deserialize, null if missing/invalid/version mismatch
  clear(): void;                                                // Remove saved state
  isAvailable(): boolean;                                       // Test localStorage access
}
```

---

## 7. UI/UX Notes

### Single Screen: The Terminal

The entire application is a single full-viewport terminal. There are no pages, modals, dialogs, navigation menus, or settings panels. The terminal has three vertical zones:

**Zone 1: Header Bar** (fixed top)
- Left-aligned: "INITECH TERMINAL v4.02"
- Right-aligned: "MOVES: {n}"
- Height: approximately 40px
- Bottom border: 1px solid `--crt-border`

**Zone 2: Output Scroll Area** (flex: 1, scrollable)
- All game output renders here as a continuous scrolling log
- New output appends to the bottom
- Auto-scrolls to bottom on new content
- Padding: 16px all sides
- Each line is an independent block element for per-line styling

**Zone 3: Input Bar** (fixed bottom)
- Left: amber `>` prompt character (20px, `--crt-amber`)
- Right: full-width text input (no border, no background, green text)
- Height: approximately 48px
- Top border: 1px solid `--crt-border`
- Input is always focused — clicking anywhere on the terminal refocuses the input
- Enter submits the command; input clears after submission
- Input is disabled and shows "thinking..." placeholder while LLM call is in flight

### CRT Visual Layers (z-index order, bottom to top)

1. Background (`--crt-bg`)
2. Ambient noise texture overlay — `z-index: 1` (2–3% opacity, tiled SVG noise pattern)
3. Phosphor bloom gradient — `z-index: 2`
4. Content (header, output, input) — `z-index: 5`
5. Scanline overlay — `z-index: 10`
6. Vignette/barrel distortion overlay — `z-index: 11`
7. Boot sequence overlay (during power-on only) — `z-index: 20`

### Boot Sequence UI

The `CrtBootSequence` component renders as a full-viewport overlay (`z-index: 20`, position fixed) above all other layers. During phases 1–3, the terminal content is not visible. The boot component emits `@complete` and is removed from the DOM (`v-if="!bootComplete"`) after phase 4 begins. The terminal fades in underneath during phase 3–4 transition.

If a saved session exists, the boot sequence runs at 2x speed and skips phase 3 (stabilization). The terminal appears with restored content immediately after the abbreviated boot.

### Typewriter Queue Behavior

The typewriter composable (`useTypewriter`) manages a FIFO queue of line batches. When a command produces output (e.g., entering a room generates 5–6 lines), the entire batch is enqueued as a unit. Lines within a batch render sequentially with the typewriter effect, with 150ms pauses between lines. The input bar is visually present but disabled (greyed prompt, no cursor blink) while text is typing. Pressing any key calls `flush()`, which instantly renders all queued lines and re-enables input.

Typewriter speed varies by line type:
- Room descriptions: 10ms/char (fast — navigation should feel snappy)
- Event scripts: 18ms/char (standard — dramatic pacing)
- Title/decorative lines: 12ms/char (medium)
- System messages: instant (no typewriter)
- Player input echo: instant (no typewriter)

### Loading / Processing State

When the LLM intent parser is called:
- Input field disables and shows placeholder "thinking..."
- A blinking "[parsing...]" line appears in the output area
- Blink animation: `opacity` alternating `0` and `0.5` on a 1-second cycle

### Empty States

- No empty states exist — the game always has content from the title sequence onward.

### Error States

- API timeout / failure: "I don't understand that. Type HELP for commands, or try saying it differently." (No technical error details shown to player.)
- Invalid command after LLM parsing: Same message as above.
- Network offline: "The connection to the mainframe has been lost. Please check your connection and try again." (Displayed once, input re-enables for retry.)

---

## 8. CI/CD & Quality Gates

1. **Linting**: ESLint configured and passing with zero errors (`npm run lint`)
2. **Test Coverage**: Minimum 80% coverage with 100% of tests passing (`npm run test`). Test framework: Vitest + Vue Test Utils. Key test targets:
   - Game engine: room transitions, item interactions, flag gating, event triggers
   - Fallback parser: all regex patterns with edge cases
   - Fuzzy matcher: exact, partial, and word-overlap matching
   - Pinia store: state mutations, inventory management, flag operations
   - PersistenceService: save, load, clear, version mismatch handling, localStorage unavailable fallback
   - useTypewriter composable: enqueue, flush, isTyping state, speed variation by line type
   - CrtBootSequence: phase transitions, abbreviated boot on restore, @complete emission
3. **TypeScript Strict**: `tsc --noEmit` passes with zero errors (strict mode enabled in `tsconfig.json`)
4. **GitHub Actions**: CI pipeline configured — runs lint, type-check, and tests on every push/PR
5. **Bedrock Inference Profiles**: The Lambda function shall call Bedrock using inference profile `us.anthropic.claude-haiku-4-5` — never a direct model ID, never a direct Anthropic API key

---

## 9. Out of Scope

- **World builder / authoring tool** — worlds are hand-authored JSON in this version
- **Multiple worlds / world selection** — the Office Space world is the only world
- **Multiplayer or shared state** — single player only
- **Audio / sound effects** — no audio in any form
- **Mobile-optimized layout** — desktop-first, mobile is unstyled
- **User accounts / auth** — no login, no user identity
- **LLM-generated content during gameplay** — no dynamic room descriptions, no generative dialogue
- **Cloud save / cross-device sync** — persistence is `localStorage` only, scoped to the browser. No server-side save state, no sync between devices.
- **Accessibility for CRT aesthetic** — the CRT color scheme does not meet WCAG contrast ratios by design; this is an intentional aesthetic choice for a personal project, not a production accessibility standard
- **Internationalization** — English only
- **Analytics / telemetry** — no tracking
- **In-game hint system** — `HELP` shows commands, but there are no contextual puzzle hints
- **WebGL / Canvas rendering** — all CRT effects are pure CSS. No `<canvas>`, no Three.js, no shader programs.
