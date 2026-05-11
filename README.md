# INITECH TERMINAL

A Zork-style text adventure engine masquerading as a forgotten amber-phosphor terminal someone left running in Initech's server room since 1987.

The first playable world is **Office Space** — a faithful walk through Peter Gibbons' liberation, from Monday morning alarm through Lumbergh's TPS reports, hypnotherapy, the Bobs, the Superman III scheme, and the printer's well-deserved end in a field.

```
═══════════════════════════════════════════
       OFFICE SPACE: THE TEXT ADVENTURE
       A Conditions-of-Employment Simulator
═══════════════════════════════════════════
"And so it begins. Another Monday. The radio jock is laughing again."
✨ CHAPTER 1: ANOTHER CASE OF THE MONDAYS
📍 Peter's Bedroom
> _
```

## Architecture

Three cleanly separated concerns, by design:

1. **Deterministic game engine** — a pure state machine. Rooms, items, NPCs, dialogue, and events are data; the engine never branches on world-specific identifiers.
2. **Hybrid intent parser** — a zero-latency regex parser handles canonical verbs; only conversational or ambiguous input falls through to an LLM (Claude Haiku via Amazon Bedrock). The LLM returns `{ action, target }`. It never generates story content.
3. **World JSON** — a single `World { rooms, items, npcs, events, dialogue }` object. Swap the file, swap the world; the engine doesn't care.

Other things worth knowing:

- **CRT aesthetic is the product, not a skin.** Power-on sequence, scanlines, phosphor bloom, barrel vignette, multi-rate flicker, typewriter rendering, phosphor decay on older lines, block cursor with square-wave blink — all pure CSS, no canvas, no WebGL.
- **Persistence is `localStorage` only.** Schema-versioned, capped at 500 history lines, silent fallback when storage is unavailable.
- **No content generation by the LLM during gameplay.** All prose is authored in the world file.

## Stack

- **Frontend** — Vue 3 + TypeScript (Composition API), Pinia, Vite. Vuetify is installed but used as scaffolding only; the visual system is hand-written CSS.
- **Backend** — AWS Lambda (Node.js 20) → Amazon Bedrock inference profile `us.anthropic.claude-haiku-4-5`.
- **Infrastructure** — AWS CDK (TypeScript): S3 + CloudFront for the SPA, HTTP API Gateway for `/api/parse-intent`, both behind a single CloudFront distribution.

## Project layout

```
src/
  engine/        Deterministic engine, regex parser, fuzzy matcher, intent client
  worlds/        World definitions (Office Space lives here)
  stores/        Pinia store (engine + persistence + UI state)
  services/      PersistenceService (localStorage)
  composables/   useTypewriter
  components/    CrtBootSequence, Terminal
  styles/        CRT visual system (custom props, scanlines, flicker, decay)
  types/         World + game state TypeScript interfaces

lambda/          Intent-parser Lambda (Bedrock invoke)
cdk/             AWS CDK stack
tests/           Vitest unit tests (220 tests, 89.8% line coverage)
docs/PRD-4.md    The source of truth — every FR-### in code refers back here
scripts/         smoke.ts: headless walk of the critical path
```

## Local development

```bash
npm install
npm run dev          # vite dev server on http://localhost:5173
npm run type-check   # strict TS
npm test             # 220 unit tests
npm run test:coverage
npm run build        # produces dist/
```

The dev server proxies `/api/*` to `localhost:3001` (assume nothing is listening — the regex parser covers canonical commands, so most gameplay works without the Lambda).

## Commands the engine understands

Canonical verbs are handled by the zero-latency regex parser:

| Verb | Aliases / examples |
|---|---|
| `GO <direction\|place>` | `n` `north` `walk to the lobby` `head over to cubicles` bare `lobby` |
| `LOOK` | `l` |
| `TAKE <item>` | `get` `grab` `pick up` |
| `DROP <item>` | `put down` |
| `EXAMINE <item\|npc>` | `inspect` `look at` `x` `read` |
| `USE <item>` | `operate` `insert` |
| `WEAR <item>` | `put on` |
| `TALK TO <npc>` | `ask`, `speak with` |
| `INVENTORY` | `inv` `i` |
| `SMASH <target>` | `destroy` `break` `attack` `wreck` |
| `INSTALL <target>` |  |
| `SAVE` / `LOAD` / `RESTART` | |
| `HELP` | `?` |

Anything that doesn't match falls through to the LLM, which returns a structured action.

## Deployment

Prerequisites (one-time):

1. **AWS credentials** with permission to create S3, CloudFront, Lambda, API Gateway, IAM.
2. **Enable Bedrock model access** for Claude Haiku in `us-west-2`:
   - AWS Console → Bedrock → Model access → Enable Anthropic Claude Haiku.
3. **CDK bootstrap** in the target region (one-time per account/region):
   ```bash
   cd cdk && npx cdk bootstrap aws://<ACCOUNT_ID>/us-west-2
   ```

Deploy:

```bash
# from repo root
npm run build              # produces dist/
cd cdk && npm install
npm run deploy             # cdk deploy
```

The stack outputs `CloudFrontDomain` — open `https://<that-domain>/` and the game runs against a same-origin `/api/*` proxy to Lambda+Bedrock.

The first deploy takes ~10 minutes (CloudFront propagation). Subsequent deploys (SPA-only changes) are ~1 minute.

## Testing

```bash
npm test                   # 220 tests
npm run test:coverage      # enforces ≥80% lines/functions/statements, ≥75% branches
```

Coverage by area:

- 100%: `parser`, `conditions`, `output`, `persistence`, `fuzzy` (effectively), `intent-client`
- 99%: `stores/game`
- 95%: `useTypewriter`
- 91% / 88%: `Terminal.vue`, `engine.ts`
- 100%: `CrtBootSequence.vue`

## Repository status

This is a personal project and architecture proof-of-concept. The Office Space world is the test payload; the engine is designed to accept any world JSON. A future LLM-powered world-builder tool is anticipated but explicitly out of scope for v1.

See `docs/PRD-4.md` for the full product requirements doc — every functional requirement is numbered (FR-###) and every behavior in the code traces back to one.

## License

[MIT](./LICENSE)
