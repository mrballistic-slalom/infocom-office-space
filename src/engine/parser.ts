import type { ParsedAction } from '@/types/game';

const DIRECTIONS: Record<string, string> = {
  n: 'north', north: 'north',
  s: 'south', south: 'south',
  e: 'east', east: 'east',
  w: 'west', west: 'west',
  up: 'up', down: 'down',
  out: 'out', outside: 'outside',
  in: 'in', inside: 'inside',
  back: 'back',
};

const RE = {
  movement: /^(?:go|move|walk|head|run)\s+(?:to\s+(?:the\s+)?|toward\s+|over\s+to\s+(?:the\s+)?)?(.+)$/i,
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
  exit: { action: 'quit' },
  save: { action: 'save' },
  load: { action: 'load' },
};

/**
 * Fast, zero-latency parser for canonical commands.
 * Returns null when input doesn't match — caller should fall through to the LLM parser.
 */
export function fallbackParse(rawInput: string): ParsedAction | null {
  const input = rawInput.trim().toLowerCase();
  if (!input) return null;

  if (input in SINGLE_WORD) return SINGLE_WORD[input];

  if (input in DIRECTIONS) {
    return { action: 'go', target: DIRECTIONS[input] };
  }

  if (RE.driveBare.test(input)) {
    return { action: 'go', target: 'drive' };
  }

  let m: RegExpMatchArray | null;
  if ((m = input.match(RE.movement))) return { action: 'go', target: m[1].trim() };
  if ((m = input.match(RE.enter))) return { action: 'go', target: m[1].trim() };
  if ((m = input.match(RE.drive))) return { action: 'go', target: m[1].trim() };
  if ((m = input.match(RE.take))) return { action: 'take', target: m[1].trim() };
  if ((m = input.match(RE.drop))) return { action: 'drop', target: m[1].trim() };
  if ((m = input.match(RE.examine))) return { action: 'examine', target: m[1].trim() };
  if ((m = input.match(RE.use))) return { action: 'use', target: m[1].trim() };
  if ((m = input.match(RE.wear))) return { action: 'wear', target: m[1].trim() };
  if ((m = input.match(RE.talk))) return { action: 'talk', target: m[1].trim() };
  if ((m = input.match(RE.ask))) return { action: 'talk', target: m[1].trim() };
  if ((m = input.match(RE.smash))) return { action: 'smash', target: m[1].trim() };
  if ((m = input.match(RE.install))) return { action: 'install', target: m[1].trim() };
  if (RE.sit.test(input)) return { action: 'sit' };
  if (RE.wait.test(input)) return { action: 'wait' };

  // Bare single-word fallback: treat as a movement target ("lobby", "cubicles", "forward").
  // The engine's fuzzy exit matcher will validate against current room exits.
  if (/^[a-z][a-z_]*$/i.test(input)) {
    return { action: 'go', target: input };
  }

  return null;
}
