import type { GameState } from '@/types/game';

/**
 * Evaluate a condition string against the current game state.
 * Supported forms: "flag:NAME", "!flag:NAME", "has:ITEM", "!has:ITEM".
 * Unrecognized strings evaluate to false.
 */
export function evaluateCondition(condition: string, state: GameState): boolean {
  const trimmed = condition.trim();
  if (!trimmed) return false;

  const negated = trimmed.startsWith('!');
  const body = negated ? trimmed.slice(1) : trimmed;
  const [kind, value] = body.split(':', 2);

  let result: boolean;
  switch (kind) {
    case 'flag':
      result = Boolean(state.flags[value]);
      break;
    case 'has':
      result = state.inventory.includes(value);
      break;
    default:
      return false;
  }
  return negated ? !result : result;
}
