import { defineStore } from 'pinia';
import type { GameState, OutputLine, ParsedAction } from '@/types/game';
import { officeSpace } from '@/worlds/office-space';
import {
  execute,
  initialState,
  openingLines,
  describeCurrentRoom,
  visibleItemsIn,
} from '@/engine/engine';
import { fallbackParse } from '@/engine/parser';
import { buildContext, parseIntentRemote } from '@/engine/intent-client';
import { makeLine } from '@/engine/output';
import { createPersistenceService } from '@/services/persistence';
import { createAuthService } from '@/services/auth';

const persistence = createPersistenceService();
const auth = createAuthService();
const world = officeSpace;

interface State {
  game: GameState;
  output: OutputLine[];
  isParsing: boolean;
  restored: boolean;
  /** Set when /api/parse-intent returns 401 — Terminal can prompt for re-auth. */
  authExpired: boolean;
}

function freshGame(): GameState {
  return initialState(world);
}

export const useGameStore = defineStore('game', {
  state: (): State => ({
    game: freshGame(),
    output: [],
    isParsing: false,
    restored: false,
    authExpired: false,
  }),

  getters: {
    moveCount: (s) => s.game.moveCount,
    gameOver: (s) => s.game.gameOver,
    persistenceAvailable: () => persistence.isAvailable(),
    world: () => world,
    currentRoom: (s) => world.rooms[s.game.currentRoom],
    visibleItems: (s) => visibleItemsIn(s.game.currentRoom, world, s.game),
  },

  actions: {
    initialize(): void {
      const saved = persistence.load();
      if (saved) {
        this.game = saved.gameState;
        this.output = saved.outputHistory;
        this.restored = true;
        this.appendSystem('[Session restored — type LOOK to re-orient]');
      } else {
        this.appendLines(openingLines(world, this.game));
        this.persist();
      }
    },

    appendLines(texts: string[]): void {
      for (const t of texts) {
        if (!t) continue;
        this.output.push(makeLine(t));
      }
    },

    appendSystem(text: string): void {
      this.output.push(makeLine(text));
    },

    appendInput(text: string): void {
      this.output.push(makeLine(`> ${text}`));
    },

    async submit(rawInput: string): Promise<void> {
      const input = rawInput.trim();
      if (!input) return;

      this.appendInput(input);

      // Meta commands handled by the store, not the engine.
      const lower = input.toLowerCase();
      if (lower === 'save') {
        this.persist();
        this.appendSystem(
          persistence.isAvailable()
            ? 'Progress saved to local terminal memory.'
            : 'Local terminal memory is unavailable in this browser mode. Progress will not persist across sessions.',
        );
        return;
      }
      if (lower === 'load') {
        const loaded = persistence.load();
        if (!loaded) {
          this.appendSystem('No saved game found.');
          return;
        }
        this.game = loaded.gameState;
        this.output = loaded.outputHistory;
        this.appendSystem('[Session restored from local terminal memory]');
        this.appendLines(describeCurrentRoom(world, this.game));
        return;
      }
      if (lower === 'restart') {
        this.restartGame();
        return;
      }

      const parsed = fallbackParse(input);
      if (parsed) {
        this.runAction(parsed);
        return;
      }

      // Fall through to remote LLM parser.
      this.isParsing = true;
      try {
        const ctx = buildContext(
          world.rooms[this.game.currentRoom],
          world,
          this.game.inventory,
          this.visibleItems,
        );
        const result = await parseIntentRemote(input, ctx, auth.getToken());
        if (result.unauthorized) {
          auth.clear();
          this.authExpired = true;
          this.appendSystem('[Session expired — re-authenticating]');
          return;
        }
        const action = result.action;
        this.runAction(action);
      } finally {
        this.isParsing = false;
      }
    },

    runAction(action: ParsedAction): void {
      const result = execute(action, { world, state: this.game });
      this.appendLines(result.lines);
      if (result.mutated) {
        this.persist();
      }
    },

    persist(): void {
      persistence.save(this.game, this.output);
    },

    restartGame(): void {
      persistence.clear();
      this.game = freshGame();
      this.output = [];
      this.appendLines(openingLines(world, this.game));
      this.persist();
    },
  },
});
