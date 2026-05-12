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
2. **Hybrid intent parser** — a zero-latency regex parser handles canonical verbs; only conversational or ambiguous input falls through to an LLM (Gemini 2.0 Flash). The LLM returns `{ action, target }` and never generates story content.
3. **World JSON** — a single `World { rooms, items, npcs, events, dialogue }` object. Swap the file, swap the world; the engine doesn't care.

Other things worth knowing:

- **CRT aesthetic is the product, not a skin.** Power-on sequence, scanlines, phosphor bloom, barrel vignette, multi-rate flicker, typewriter rendering, phosphor decay on older lines, block cursor with square-wave blink — all pure CSS, no canvas, no WebGL.
- **Persistence is `localStorage` only.** Schema-versioned, capped at 500 history lines, silent fallback when storage is unavailable.
- **No content generation by the LLM during gameplay.** All prose is authored in the world file.
- **No auth layer.** Gemini's free-tier rate cap is the natural abuse limit; there's no per-token AWS-style billing to worry about.

## Stack

- **Frontend** — Vue 3 + TypeScript (Composition API), Pinia, Vite. Vuetify is installed but used as scaffolding only; the visual system is hand-written CSS.
- **Backend** — Long-running Node 22 Express server (`server/`), managed by pm2 in cluster mode (2 workers + zero-downtime reload). One route: `POST /api/parse-intent`.
- **LLM** — Google Gemini 2.0 Flash via `@google/generative-ai` with structured-output schema for clean JSON.
- **Hosting** — Ubuntu + Apache (or Nginx). Apache serves the SPA out of `/var/www/initech`; `/api/*` reverse-proxies to `127.0.0.1:3001`. Let's Encrypt for TLS via certbot.

## Project layout

```
src/
  engine/        Deterministic engine, regex parser, fuzzy matcher, intent client
  worlds/        World definitions (Office Space lives here)
  stores/        Pinia store (engine + persistence + UI state)
  services/      Persistence (localStorage), Analytics (gtag)
  composables/   useTypewriter
  components/    CrtBootSequence, Terminal
  styles/        CRT visual system (custom props, scanlines, flicker, decay)
  types/         World + game state TypeScript interfaces

server/          Express backend (pm2 cluster) — /api/parse-intent + /health
deploy/          Apache vhost, Nginx alt, pm2 ecosystem, systemd unit, deploy.sh
public/          favicon.svg, og-image.svg (static assets shipped with the SPA)
tests/           Vitest unit tests
docs/PRD-4.md    The source of truth — every FR-### in code refers back here
scripts/         smoke.ts (engine walk), world-audit.ts (graph integrity)
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

Self-hosted Ubuntu + Apache + pm2 + Gemini. Full one-time-setup runbook + ops cheatsheet lives in [`deploy/README.md`](./deploy/README.md).

Two flows for each release:

- **From your workstation:** `DEPLOY_HOST=user@host ./deploy/deploy.sh` (rsync + remote `pm2 reload`).
- **From the box itself:** `git pull && ./deploy/deploy-local.sh` (build in place, sudo-rsync into `/var/www/initech` and `/opt/initech-backend`, drop to the `initech` user for pm2).

Either flow is zero-downtime — pm2's cluster mode reloads workers one at a time.

</details>

> **Migrated away from AWS.** Earlier revisions ran on S3 + CloudFront + Lambda → Bedrock Claude Haiku, with a password gate and JWT auth. That stack lived in `cdk/` and `lambda/` (now removed). If you have a running CloudFront/Lambda deploy from before this migration, run `cdk destroy` from a checkout of the pre-migration tag to tear it down. The git history has everything you need to recover the AWS path.

## Testing

```bash
npm test                   # frontend (vitest, ~260 tests)
npm run test:coverage      # enforces ≥80% lines/functions/statements, ≥75% branches

# server tests (in their own dir)
cd server && npm test      # vitest + supertest
```

## Repository status

This is a personal project and architecture proof-of-concept. The Office Space world is the test payload; the engine is designed to accept any world JSON. A future LLM-powered world-builder tool is anticipated but explicitly out of scope for v1.

See `docs/PRD-4.md` for the full product requirements doc — every functional requirement is numbered (FR-###) and every behavior in the code traces back to one.

## Social previews

`index.html` has the full Open Graph + Twitter Card meta block pointed at `https://initech.mrballistic.com/` and a 1200×630 SVG card at `public/og-image.svg`. The favicon is `public/favicon.svg` — a single amber phosphor cursor on black, scanlines.

If you find a scraper that doesn't render SVG (rare in 2026 but possible), drop a 1200×630 PNG at `public/og-image.png` and swap the `og:image` / `twitter:image` URLs in `index.html`.

After deploys, validate previews with:
- Facebook: https://developers.facebook.com/tools/debug/
- Twitter / X: https://cards-dev.twitter.com/validator
- LinkedIn: https://www.linkedin.com/post-inspector/
- Slack just refetches when you post a fresh URL.

## Analytics

Google Analytics 4 fires on production builds only. The measurement ID is read from `VITE_GA_MEASUREMENT_ID` (see `.env.production`). gtag is **not** loaded when:

- The ID is unset or still the `G-XXX...` placeholder
- The browser sends `navigator.doNotTrack === '1'`

Two custom events beyond the auto-pageview: `game_start` on fresh init, `game_completed` (with `move_count`) when the printer-smash ending fires. Resumed sessions fire `session_resumed` instead of `game_start`.

## License

[MIT](./LICENSE)
