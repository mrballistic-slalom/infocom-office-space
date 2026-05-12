import { fallbackParse } from '@/engine/parser';

describe('fallbackParse', () => {
  describe('empty / invalid input', () => {
    it('returns null for an empty string', () => {
      expect(fallbackParse('')).toBeNull();
    });

    it('returns null for whitespace-only input', () => {
      expect(fallbackParse('   ')).toBeNull();
    });

    it('returns null for pure punctuation/garbage', () => {
      expect(fallbackParse('!!!')).toBeNull();
      expect(fallbackParse('@#$%')).toBeNull();
    });
  });

  describe('single-word commands', () => {
    it.each([
      ['look', { action: 'look' }],
      ['l', { action: 'look' }],
      ['inventory', { action: 'inventory' }],
      ['inv', { action: 'inventory' }],
      ['i', { action: 'inventory' }],
      ['help', { action: 'help' }],
      ['?', { action: 'help' }],
      ['restart', { action: 'restart' }],
      ['quit', { action: 'quit' }],
      ['save', { action: 'save' }],
      ['load', { action: 'load' }],
    ])('parses %s', (input, expected) => {
      expect(fallbackParse(input)).toEqual(expected);
    });

    it('is case-insensitive', () => {
      expect(fallbackParse('HELP')).toEqual({ action: 'help' });
      expect(fallbackParse('Inventory')).toEqual({ action: 'inventory' });
    });
  });

  describe('bare directions', () => {
    it.each([
      ['n', 'north'],
      ['north', 'north'],
      ['s', 'south'],
      ['e', 'east'],
      ['w', 'west'],
      ['up', 'up'],
      ['down', 'down'],
      ['out', 'out'],
      ['outside', 'outside'],
      ['in', 'in'],
      ['inside', 'inside'],
      ['back', 'back'],
    ])('parses bare %s as go %s', (input, target) => {
      expect(fallbackParse(input)).toEqual({ action: 'go', target });
    });
  });

  describe('movement', () => {
    it('parses "go north"', () => {
      expect(fallbackParse('go north')).toEqual({ action: 'go', target: 'north' });
    });

    it('parses "walk to the lobby"', () => {
      expect(fallbackParse('walk to the lobby')).toEqual({ action: 'go', target: 'lobby' });
    });

    it('parses "head over to the cubicles"', () => {
      expect(fallbackParse('head over to the cubicles')).toEqual({
        action: 'go',
        target: 'cubicles',
      });
    });

    it('parses "move toward break room"', () => {
      expect(fallbackParse('move toward break room')).toEqual({
        action: 'go',
        target: 'break room',
      });
    });

    it('parses "run to lobby"', () => {
      expect(fallbackParse('run to lobby')).toEqual({ action: 'go', target: 'lobby' });
    });
  });

  describe('enter / drive', () => {
    it('parses "enter lobby"', () => {
      expect(fallbackParse('enter lobby')).toEqual({ action: 'go', target: 'lobby' });
    });

    it('parses "drive to work"', () => {
      expect(fallbackParse('drive to work')).toEqual({ action: 'go', target: 'work' });
    });

    it('parses bare "drive"', () => {
      expect(fallbackParse('drive')).toEqual({ action: 'go', target: 'drive' });
    });

    it('parses bare "leave"', () => {
      expect(fallbackParse('leave')).toEqual({ action: 'go', target: 'drive' });
    });
  });

  describe('take synonyms', () => {
    it.each(['take', 'get', 'grab', 'pick up'])('parses "%s stapler"', (verb) => {
      expect(fallbackParse(`${verb} stapler`)).toEqual({ action: 'take', target: 'stapler' });
    });

    it('strips a leading "the"', () => {
      expect(fallbackParse('take the stapler')).toEqual({ action: 'take', target: 'stapler' });
    });
  });

  describe('drop variants', () => {
    it('parses "drop wallet"', () => {
      expect(fallbackParse('drop wallet')).toEqual({ action: 'drop', target: 'wallet' });
    });

    it('parses "put down the wallet"', () => {
      expect(fallbackParse('put down the wallet')).toEqual({
        action: 'drop',
        target: 'wallet',
      });
    });
  });

  describe('examine synonyms', () => {
    it.each(['examine', 'inspect', 'x', 'read'])('parses "%s stapler"', (verb) => {
      expect(fallbackParse(`${verb} stapler`)).toEqual({
        action: 'examine',
        target: 'stapler',
      });
    });

    it('parses "look at the stapler"', () => {
      expect(fallbackParse('look at the stapler')).toEqual({
        action: 'examine',
        target: 'stapler',
      });
    });
  });

  describe('use / wear', () => {
    it('parses "use terminal"', () => {
      expect(fallbackParse('use terminal')).toEqual({ action: 'use', target: 'terminal' });
    });

    it('parses "insert disk in drive"', () => {
      expect(fallbackParse('insert disk in drive')).toEqual({ action: 'use', target: 'disk' });
    });

    it('parses "wear hawaiian shirt"', () => {
      expect(fallbackParse('wear hawaiian shirt')).toEqual({
        action: 'wear',
        target: 'hawaiian shirt',
      });
    });

    it('parses "put on the shirt"', () => {
      expect(fallbackParse('put on the shirt')).toEqual({ action: 'wear', target: 'shirt' });
    });
  });

  describe('talk / ask', () => {
    it('parses "talk to lumbergh"', () => {
      expect(fallbackParse('talk to lumbergh')).toEqual({ action: 'talk', target: 'lumbergh' });
    });

    it('parses "talk with joanna"', () => {
      expect(fallbackParse('talk with joanna')).toEqual({ action: 'talk', target: 'joanna' });
    });

    it('strips "the" — "talk to the bartender"', () => {
      expect(fallbackParse('talk to the bartender')).toEqual({
        action: 'talk',
        target: 'bartender',
      });
    });

    it('parses "ask milton about fire"', () => {
      expect(fallbackParse('ask milton about fire')).toEqual({
        action: 'talk',
        target: 'milton',
      });
    });
  });

  describe('smash / install / sit / wait', () => {
    it.each(['smash', 'destroy', 'break', 'kill', 'hit', 'attack', 'wreck'])(
      'parses "%s printer"',
      (verb) => {
        expect(fallbackParse(`${verb} printer`)).toEqual({
          action: 'smash',
          target: 'printer',
        });
      },
    );

    it('parses "install virus"', () => {
      expect(fallbackParse('install virus')).toEqual({ action: 'install', target: 'virus' });
    });

    it('parses "sit"', () => {
      expect(fallbackParse('sit')).toEqual({ action: 'sit' });
    });

    it('parses "sit down"', () => {
      expect(fallbackParse('sit down')).toEqual({ action: 'sit' });
    });

    it('parses "relax"', () => {
      expect(fallbackParse('relax')).toEqual({ action: 'sit' });
    });

    it('parses "wait"', () => {
      expect(fallbackParse('wait')).toEqual({ action: 'wait' });
    });

    it('parses "z" as wait', () => {
      expect(fallbackParse('z')).toEqual({ action: 'wait' });
    });
  });

  describe('bare word fallback', () => {
    it('treats a bare word as a "go" target', () => {
      expect(fallbackParse('lobby')).toEqual({ action: 'go', target: 'lobby' });
    });

    it('treats a word with underscores as a "go" target', () => {
      expect(fallbackParse('break_room')).toEqual({ action: 'go', target: 'break_room' });
    });
  });

  describe('case insensitivity overall', () => {
    it('upper-cased verbs still parse', () => {
      expect(fallbackParse('TAKE STAPLER')).toEqual({ action: 'take', target: 'stapler' });
      expect(fallbackParse('Go North')).toEqual({ action: 'go', target: 'north' });
    });
  });

  describe('exit verb', () => {
    it('parses "exit to living room"', () => {
      expect(fallbackParse('exit to living room')).toEqual({
        action: 'go',
        target: 'living room',
      });
    });
    it('parses "exit to the living room"', () => {
      expect(fallbackParse('exit to the living room')).toEqual({
        action: 'go',
        target: 'living room',
      });
    });
    it('parses "exit to living_room" (snake_case)', () => {
      expect(fallbackParse('exit to living_room')).toEqual({
        action: 'go',
        target: 'living_room',
      });
    });
    it('parses bare "exit" as go out', () => {
      expect(fallbackParse('exit')).toEqual({ action: 'go', target: 'out' });
    });
  });

  describe('snooze verb', () => {
    it('parses bare "snooze"', () => {
      expect(fallbackParse('snooze')).toEqual({ action: 'snooze' });
    });
    it('parses "hit snooze"', () => {
      expect(fallbackParse('hit snooze')).toEqual({ action: 'snooze' });
    });
    it('parses "hit the snooze button"', () => {
      expect(fallbackParse('hit the snooze button')).toEqual({ action: 'snooze' });
    });
    it('parses "press snooze"', () => {
      expect(fallbackParse('press snooze')).toEqual({ action: 'snooze' });
    });
  });
});
