import type { ParsedAction } from '@/types/game';

const DIRECTIONS: Record<string, string> = {
  n: 'north', north: 'north',
  s: 'south', south: 'south',
  e: 'east', east: 'east',
  w: 'west', west: 'west',
  up: 'up', down: 'down',
  out: 'out', outside: 'outside', exit: 'out',
  in: 'in', inside: 'inside',
  back: 'back',
};

const RE = {
  movement: /^(?:go|move|walk|head|run|exit)\s+(?:to\s+(?:the\s+)?|toward\s+|over\s+to\s+(?:the\s+)?|out\s+to\s+(?:the\s+)?)?(.+)$/i,
  enter: /^(?:enter|into)\s+(?:the\s+)?(.+)$/i,
  drive: /^(?:drive\s+to|drive|take\s+the\s+car(?:\s+to)?)\s+(.+)$/i,
  driveBare: /^(?:drive|leave)$/i,
  take: /^(?:take|get|grab|pick\s+up)\s+(?:the\s+)?(.+)$/i,
  drop: /^(?:drop|put\s+down|leave)\s+(?:the\s+)?(.+)$/i,
  examine: /^(?:examine|inspect|look\s+at|x|read)\s+(?:the\s+)?(.+)$/i,
  use: /^(?:use|operate|insert)\s+(?:the\s+)?(.+?)(?:\s+(?:on|in|with)\s+.+)?$/i,
  wear: /^(?:wear|put\s+on)\s+(?:the\s+)?(.+)$/i,
  talk: /^(?:talk|speak|chat)\s+(?:to|with)\s+(?:the\s+)?(.+)$/i,
  ask: /^(?:ask|question)\s+(?:the\s+)?(.+?)(?:\s+about\s+.+)?$/i,
  smash: /^(?:smash|destroy|break|kill|hit|attack|wreck)\s+(?:the\s+)?(.+)$/i,
  install: /^(?:install|run|load)\s+(?:the\s+)?(.+)$/i,
  sit: /^(?:sit(?:\s+down)?|relax)$/i,
  wait: /^(?:wait|z)$/i,
  snooze: /^(?:snooze|hit\s+(?:the\s+)?snooze(?:\s+button)?|press\s+snooze)$/i,
};

const SINGLE_WORD: Record<string, ParsedAction> = {
  look: { action: 'look' },
  l: { action: 'look' },
  inventory: { action: 'inventory' },
  inv: { action: 'inventory' },
  i: { action: 'inventory' },
  help: { action: 'help' },
  '?': { action: 'help' },
  restart: { action: 'restart' },
  quit: { action: 'quit' },
  save: { action: 'save' },
  load: { action: 'load' },
};

// Each entry maps a verb-pattern regex (whose first capture group is the target) to the
// canonical action. Order matters — earlier entries win on ambiguous input.
const VERB_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [RE.movement, 'go'],
  [RE.enter, 'go'],
  [RE.drive, 'go'],
  [RE.take, 'take'],
  [RE.drop, 'drop'],
  [RE.examine, 'examine'],
  [RE.use, 'use'],
  [RE.wear, 'wear'],
  [RE.talk, 'talk'],
  [RE.ask, 'talk'],
  [RE.smash, 'smash'],
  [RE.install, 'install'],
];

/**
 * Fast, zero-latency parser for canonical commands.
 * Returns null when input doesn't match — caller should fall through to the LLM parser.
 */
export function fallbackParse(rawInput: string): ParsedAction | null {
  const input = rawInput.trim().toLowerCase();
  if (!input) return null;

  if (input in SINGLE_WORD) return SINGLE_WORD[input];
  if (input in DIRECTIONS) return { action: 'go', target: DIRECTIONS[input] };
  if (RE.driveBare.test(input)) return { action: 'go', target: 'drive' };
  // snooze runs before the verb-pattern loop because "hit" is a smash synonym;
  // "hit snooze" would otherwise be parsed as smash("snooze").
  if (RE.snooze.test(input)) return { action: 'snooze' };

  for (const [re, action] of VERB_PATTERNS) {
    const m = input.match(re);
    if (m) return { action, target: m[1].trim() };
  }

  if (RE.sit.test(input)) return { action: 'sit' };
  if (RE.wait.test(input)) return { action: 'wait' };

  // Bare single-word fallback: treat as a movement target ("lobby", "cubicles", "forward").
  // The engine's fuzzy exit matcher will validate against current room exits.
  if (/^[a-z][a-z_]*$/i.test(input)) {
    return { action: 'go', target: input };
  }

  return null;
}
