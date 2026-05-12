# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**INITECH TERMINAL** is a Zork-style text adventure engine. The first playable world is an Office Space (1999 film) retelling. The CRT-terminal aesthetic isn't a skin — it's the product.

`docs/PRD-4.md` is the original product requirements doc. Many design choices that look arbitrary trace back to an FR-### in there. Re-read the relevant section before changing direction.

## Architecture

Three cleanly separated concerns. Don't let them leak into each other.

1. **Deterministic game engine** (`src/engine/`) — pure state machine over `GameState { currentRoom, inventory, flags[], moveCount, gameOver, ... }`. Rooms, items, NPCs, events, and dialogue are consumed as data; the engine never branches on world-specific identifiers.
2. **Hybrid intent parser** — `src/engine/parser.ts` is a zero-latency regex parser for canonical verbs; `src/engine/intent-client.ts` posts to `/api/parse-intent` for anything the regex can't handle. The LLM returns `{ action, target }` and **never** generates story content. Treat content generation by the LLM as a defect.
3. **World JSON** (`src/worlds/`) — a single `World { rooms, items, npcs, events, dialogue, startRoom }` object. Swap the file, swap the world; the engine doesn't care.

Other invariants:

- **Persistence is `localStorage` only.** Schema-versioned, capped at 500 history lines, silent fallback when storage is unavailable. No server-side state.
- **Conditions are strings parsed by the engine.** Formats: `flag:NAME`, `!flag:NAME`, `has:ITEM`, `!has:ITEM`. Keep the condition parser in one place (`src/engine/conditions.ts`).
- **Fuzzy matching is centralized.** Both parser paths route through `src/engine/fuzzy.ts` (exact ID → name → substring → token-prefix) before execution. Don't inline fuzzy logic in handlers.
- **Output classification drives styling.** `OutputLineType` (`input | location | event | decorative | system | prose`) is detected from line prefixes (`> `, `📍`, leading emoji, `═`/`"`, `[`). The engine produces classified lines; the renderer styles them.
- **No auth layer.** Gemini's free-tier rate cap is the natural abuse limit; there's no per-token billing to worry about.

## Stack

- **Frontend** — Vue 3 + TypeScript (Composition API, `<script setup>`), Pinia for state, Vite. Vuetify is installed as scaffolding only — the CRT visual system is hand-written CSS in `src/styles/crt.css`.
- **Backend** — Long-running Node 22 Express server (`server/`). One route: `POST /api/parse-intent`. Also `/health`. No auth, no JWT.
- **LLM** — Google Gemini 2.0 Flash via `@google/generative-ai` with `responseMimeType: 'application/json'` + `responseSchema`. Forces clean JSON; no markdown-fence stripping needed.
- **Process supervision** — pm2 in cluster mode, 2 workers, zero-downtime reload via SIGTERM drain.
- **Hosting** — Ubuntu + Apache (or Nginx). Apache serves `/var/www/initech` for the SPA, reverse-proxies `/api/*` to `127.0.0.1:3001`. TLS via Let's Encrypt + certbot.
- **Analytics** — Google Analytics 4 via gtag, honors `Do Not Track`, fires `game_start` / `game_completed` / `session_resumed`. Measurement ID in `.env.production`.

## Layout

```
src/             Frontend (Vue 3 + Pinia + Vite)
  engine/        State machine, parser, fuzzy matcher, intent client
  worlds/        Office Space world (rooms, items, NPCs, events, dialogue)
  stores/game.ts Pinia store — single source of truth for the SPA
  services/      persistence (localStorage), analytics (gtag)
  composables/   useTypewriter
  components/    CrtBootSequence, Terminal
  styles/crt.css Custom-property-driven CRT effects
  types/         World + game state types

server/          Express backend (pm2 cluster)
  src/index.ts   App + graceful shutdown
  src/config.ts  Env-var loader (fail-fast on missing GEMINI_KEY)
  src/llm.ts     Gemini wrapper with structured-output schema
  src/routes/    parse-intent.ts

deploy/          Apache vhosts (port-80 bootstrap + 443), Nginx alt,
                 pm2 ecosystem, systemd unit, deploy.sh + deploy-local.sh,
                 deploy/README.md = ops runbook

public/          favicon.svg, og-image.svg (1200×630 CRT card)
tests/           Vitest unit tests (frontend)
scripts/         smoke.ts (engine walk), world-audit.ts (graph integrity),
                 scrub-password-history.sh (one-shot history-rewrite tool)
docs/PRD-4.md    Original requirements doc
```

## Design rules that are easy to violate

- **Vuetify is scaffolding only.** No Vuetify theme colors, shadows, or default component styles on game-facing UI. The CRT visual system is hand-written CSS.
- **The CRT aesthetic is the product.** Power-on sequence, scanlines, phosphor bloom, barrel vignette, multi-rate flicker, typewriter rendering, phosphor decay on older lines, block cursor with square-wave blink — all required. Pure CSS; no `<canvas>`, no WebGL.
- **Typewriter rates differ by line type** (FR-036): room descriptions 10ms/char, event scripts 18ms/char, decorative 12ms/char, system + input echo instant. Build this into the `useTypewriter` composable, not into call sites.
- **Restored sessions render instantly** — no typewriter replay on `outputHistory` from `localStorage`, and the boot sequence runs abbreviated (~450ms, skip phase 3).
- **Gemini timeout is 5s.** Fail fast back to `{ action: "unknown" }` rather than hanging the input.
- **`outputHistory` is capped at 500 lines on save** to avoid `localStorage` quota issues.
- **CRT contrast is intentionally non-WCAG.** Don't "fix" the amber-on-black palette for accessibility — it's an explicit non-goal.
- **New verbs go in three places.** Adding a new action verb? Update the parser regex (`src/engine/parser.ts`), the engine dispatcher (`src/engine/engine.ts`), AND the Gemini `ACTION_VOCAB` (`server/src/llm.ts`). Miss the third and the LLM fallback returns `unknown` for natural-language variants. A derived constant would help; not worth it yet.

## CI

`.github/workflows/ci.yml` runs on push/PR to `main`:

- **frontend** job: `npm ci` → `npm run type-check` → `npm run test:coverage` → `npm run build`.
- **server** job: same flow in `server/` (Vitest + supertest + tsc).

Coverage thresholds are enforced for the frontend (≥80% lines/functions/statements, ≥75% branches).

## Working on this repo

- World content (`src/worlds/office-space.ts`) is authored data. The simplifier explicitly skips it. Add new rooms/items/NPCs there, but don't refactor the data shape unless changing the engine schema first.
- `tests/worlds/reachability.test.ts` catches dead-end rooms, broken exit destinations, missing events, and missing flag setters. Run it after world edits.
- When adding interactive items (smashable, snoozable, etc.), the engine already has `onSmash` / `onSnooze` hooks on the `Item` interface. Reach for those before adding more engine code.
- Every backend env var the server reads (`GEMINI_KEY`, optional `PORT`/`HOST`/`GEMINI_MODEL`) goes through `server/src/config.ts`. Add new ones there, not via direct `process.env` reads in handlers.
- `docs/PRD-4.md` is the historical spec. Some FRs (auth/JWT) are now obsolete on this branch — the deployment model migrated from AWS Lambda → self-hosted Node. The engine + world FRs are still authoritative.
