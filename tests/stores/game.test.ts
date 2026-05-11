import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '@/stores/game';
import { SAVE_KEY } from '@/types/game';

function freshStore(): ReturnType<typeof useGameStore> {
  setActivePinia(createPinia());
  return useGameStore();
}

describe('useGameStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('starts a fresh game when no save exists, emitting intro + opening room', () => {
      const store = freshStore();
      store.initialize();

      expect(store.game.currentRoom).toBe('apartment_bedroom');
      expect(store.game.moveCount).toBe(0);
      expect(store.restored).toBe(false);
      // Intro chapter banner is in opening output.
      expect(store.output.some((l) => l.text.includes('CHAPTER 1'))).toBe(true);
      // First room name rendered.
      expect(store.output.some((l) => l.text.includes("Peter's Bedroom"))).toBe(true);
      // Initial state persisted.
      expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
    });

    it('restores from localStorage and emits a "[Session restored ...]" notice', () => {
      // Seed a save by initializing once and submitting a move.
      const first = freshStore();
      first.initialize();
      void first.submit('west');

      // New store on the same localStorage should restore.
      const second = freshStore();
      second.initialize();

      expect(second.restored).toBe(true);
      expect(second.game.currentRoom).toBe('apartment_living');
      expect(
        second.output.some((l) => l.text.includes('Session restored')),
      ).toBe(true);
    });
  });

  describe('submit (regex parser path)', () => {
    it('echoes the player input as an output line prefixed with "> "', async () => {
      const store = freshStore();
      store.initialize();
      await store.submit('west');
      expect(store.output.some((l) => l.text === '> west')).toBe(true);
    });

    it('ignores empty input', async () => {
      const store = freshStore();
      store.initialize();
      const before = store.output.length;
      await store.submit('   ');
      expect(store.output.length).toBe(before);
    });

    it('moves rooms on a recognized direction and increments moveCount', async () => {
      const store = freshStore();
      store.initialize();
      await store.submit('west');
      expect(store.game.currentRoom).toBe('apartment_living');
      expect(store.game.moveCount).toBe(1);
    });

    it('mutates inventory through TAKE/DROP', async () => {
      const store = freshStore();
      store.initialize();
      await store.submit('west');
      await store.submit('take wallet');
      expect(store.game.inventory).toContain('wallet');
      await store.submit('drop wallet');
      expect(store.game.inventory).not.toContain('wallet');
    });

    it('persists after a mutating command', async () => {
      const store = freshStore();
      store.initialize();
      await store.submit('west');

      const saved = JSON.parse(localStorage.getItem(SAVE_KEY)!);
      expect(saved.gameState.currentRoom).toBe('apartment_living');
    });
  });

  describe('save / load / restart meta commands', () => {
    it('explicit SAVE writes to localStorage and prints a confirmation', async () => {
      const store = freshStore();
      store.initialize();
      localStorage.removeItem(SAVE_KEY);

      await store.submit('save');
      expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
      expect(
        store.output.some((l) => l.text.includes('saved to local terminal memory')),
      ).toBe(true);
    });

    it('explicit LOAD restores the last save', async () => {
      const store = freshStore();
      store.initialize();
      await store.submit('west');
      await store.submit('take wallet');

      // Wipe in-memory state but keep the save, then LOAD.
      store.game.currentRoom = 'apartment_bedroom';
      store.game.inventory = [];

      await store.submit('load');
      expect(store.game.currentRoom).toBe('apartment_living');
      expect(store.game.inventory).toContain('wallet');
    });

    it('LOAD with no save prints a "No saved game" notice', async () => {
      const store = freshStore();
      store.initialize();
      localStorage.removeItem(SAVE_KEY);
      await store.submit('load');
      expect(store.output.some((l) => l.text.includes('No saved game'))).toBe(true);
    });

    it('RESTART clears save and starts fresh', async () => {
      const store = freshStore();
      store.initialize();
      await store.submit('west');
      await store.submit('take wallet');

      await store.submit('restart');
      expect(store.game.currentRoom).toBe('apartment_bedroom');
      expect(store.game.inventory).toEqual([]);
      expect(store.game.moveCount).toBe(0);
      // A fresh save should now exist (post-restart persist).
      expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
    });
  });

  describe('LLM fallback path', () => {
    it('calls the intent client for unparseable input and runs the returned action', async () => {
      const store = freshStore();
      store.initialize();

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ action: 'go', target: 'west' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await store.submit("alright I guess I'll head out west");
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(store.game.currentRoom).toBe('apartment_living');
    });

    it('falls back to "unknown" when the intent endpoint errors', async () => {
      const store = freshStore();
      store.initialize();
      const before = store.game.currentRoom;

      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('network')),
      );

      await store.submit('do something strange and impossible');
      expect(store.game.currentRoom).toBe(before);
      expect(
        store.output.some((l) => l.text.includes("don't understand")),
      ).toBe(true);
    });

    it('sets isParsing during the LLM call and clears it after', async () => {
      const store = freshStore();
      store.initialize();

      let resolveFetch: (v: Response) => void = () => {};
      const pending = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending));

      const p = store.submit('rambling that the regex parser cannot handle');
      // Allow microtasks to flush so isParsing flips on.
      await Promise.resolve();
      expect(store.isParsing).toBe(true);

      resolveFetch({
        ok: true,
        json: () => Promise.resolve({ action: 'look' }),
      } as unknown as Response);
      await p;
      expect(store.isParsing).toBe(false);
    });
  });

  describe('getters', () => {
    it('moveCount and gameOver mirror state', async () => {
      const store = freshStore();
      store.initialize();
      expect(store.moveCount).toBe(0);
      expect(store.gameOver).toBe(false);
      await store.submit('west');
      expect(store.moveCount).toBe(1);
    });

    it('visibleItems excludes items already in inventory', async () => {
      const store = freshStore();
      store.initialize();
      await store.submit('west');
      expect(store.visibleItems).toContain('wallet');
      await store.submit('take wallet');
      expect(store.visibleItems).not.toContain('wallet');
    });
  });
});
