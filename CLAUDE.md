# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This repo is **pre-implementation**. The only artifact is `docs/PRD-4.md`, the product requirements doc for **INITECH TERMINAL** — a Zork-style text adventure engine whose first world is an Office Space (1999 film) retelling.

`docs/PRD-4.md` is the source of truth. Before scaffolding code, suggesting a structure, or changing direction, re-read the relevant FR-### section — many design choices that look arbitrary are pinned by acceptance criteria there.

## Planned architecture (per PRD)

The PRD enforces a three-concern split. Keep these layers independent; do not let them leak into each other:

1. **Deterministic game engine** — pure state machine over `GameState { currentRoom, inventory, flags[], moveCount, gameOver, outputHistory }`. Rooms, items, NPCs, events, and dialogue are consumed as data; the engine never branches on world-specific identifiers.
2. **Intent parser (hybrid regex + LLM)** — a zero-latency regex parser handles canonical verbs (FR-009); only conversational/ambiguous input falls through to the LLM. The LLM call returns `{ action, target }` and **never** generates story content. Treat content generation by the LLM as a defect.
3. **World JSON** — a single `World { rooms, items, npcs }` object plus sibling `EVENTS` and `NPC_DIALOGUE` maps (FR-014..FR-019). The schema must stay world-agnostic — a future authoring tool should be able to ship a new world with zero engine changes.

Other architectural invariants:

- **No server-side data store.** Persistence is `localStorage` only, key `initech-terminal:save`, schema-versioned (FR-008a..g). If `localStorage` is unavailable, fall back silently — never surface an error.
- **Conditions are strings, parsed by the engine.** Formats: `flag:NAME`, `!flag:NAME`, `has:ITEM`, `!has:ITEM` (FR-003). Keep the parser in one place.
- **Fuzzy matching is centralized.** Both parsers route through one fuzzy layer (FR-013: exact ID → partial → word-overlap) before execution. Don't inline fuzzy logic in handlers.
- **Output classification drives styling.** `OutputLineType` (`input | location | event | decorative | system | prose`) is detected from line prefixes (`> `, `📍`, leading emoji, `═`/`"`, `[`) — see FR-032. The engine produces classified lines; the renderer styles them.

## Planned stack

- Frontend: **Vue 3 + TypeScript** (Composition API, `<script setup>`), **Pinia** for game state + persistence, **Vue Router** (single route), **Vuetify 3 as scaffolding only**.
- Backend: **AWS CDK** (TypeScript) → **API Gateway HTTP API** → **Lambda (Node.js 20)** → **Bedrock**.
- LLM: **Claude Haiku via inference profile `us.anthropic.claude-haiku-4-5`** — call the inference profile, never a raw model ID or the Anthropic API directly (FR-011, §8.5).
- Hosting: **S3 + CloudFront** for the SPA.

## Design rules that are easy to violate

- **Vuetify is scaffolding only.** No Vuetify theme colors, shadows, or default component styles may be visible on game-facing UI. The CRT visual system is hand-written CSS. (§5 deviation note.)
- **The CRT aesthetic is the product, not a skin.** Power-on sequence, scanlines, phosphor bloom, barrel vignette, multi-rate flicker, typewriter rendering, phosphor decay on older lines, block cursor with square-wave blink — all are required (FR-025..FR-041). All effects are pure CSS; no `<canvas>`, no WebGL.
- **Typewriter rates differ by line type** (FR-036): room descriptions 10ms/char, event scripts 18ms/char, decorative 12ms/char, system + input echo instant, restored history instant. Build this into the `useTypewriter` composable, not into call sites.
- **Restored sessions render instantly** — no typewriter replay on `outputHistory` from `localStorage`, and the boot sequence runs abbreviated (~450ms, skip phase 3) per FR-037.
- **Bedrock timeout is 5s; Lambda timeout is 10s.** Fail fast back to `{ action: "unknown" }` rather than hanging the input (FR-012, §6).
- **`outputHistory` is capped at 500 lines on save** to avoid `localStorage` quota issues (FR-008g).
- **CRT contrast is intentionally non-WCAG.** Don't "fix" the amber-on-black palette for accessibility — it's an explicit non-goal (§9).

## CI/CD gates (when implemented)

`npm run lint` (ESLint, zero errors), `npm run test` (Vitest + Vue Test Utils, ≥80% coverage, 100% pass), `tsc --noEmit` (strict mode). GitHub Actions runs all three on push/PR. See §8 for the explicit test targets — engine transitions, regex parser edge cases, fuzzy matcher, Pinia store, `PersistenceService`, `useTypewriter`, `CrtBootSequence`.

## Working on this repo

- When asked to "start" or "scaffold," confirm framework choices match the PRD before generating; deviations require an explicit user decision.
- When implementing a feature, cite the FR-### you're satisfying in commits/PRs — it makes acceptance review trivial against the PRD.
- The Office Space world content (rooms, items, NPCs, events, critical-path gating) is fully enumerated in FR-020..FR-024. Treat those tables as the spec, not as examples.
