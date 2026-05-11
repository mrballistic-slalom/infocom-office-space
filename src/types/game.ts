export interface GameState {
  currentRoom: string;
  inventory: string[];
  flags: Record<string, boolean>;
  moveCount: number;
  gameOver: boolean;
  /** Items dropped or removed from world after start, keyed by room ID. */
  itemsRemoved: Record<string, string[]>;
  /** Items added to a room after start (e.g. dropped from inventory). */
  itemsAdded: Record<string, string[]>;
  /** Event scripts that have already fired (gates one-shot events). */
  firedEvents: string[];
}

export type OutputLineType =
  | 'input'
  | 'location'
  | 'event'
  | 'decorative'
  | 'system'
  | 'prose';

export interface OutputLine {
  id: string;
  text: string;
  timestamp: number;
  type: OutputLineType;
}

export interface ParsedAction {
  action: string;
  target?: string;
}

export interface SavedState {
  version: string;
  savedAt: string;
  gameState: GameState;
  outputHistory: OutputLine[];
}

export const SAVE_KEY = 'initech-terminal:save' as const;
export const SAVE_VERSION = '1.0' as const;
