export interface Room {
  name: string;
  description: string;
  exits: Record<string, string>;
  items: string[];
  npcs: string[];
  onEnter: EventTrigger[];
  requires?: string;
}

export interface EventTrigger {
  if: string;
  then: string;
}

export interface Item {
  name: string;
  description: string;
  portable: boolean;
  tags: string[];
  onTake?: string;
}

export interface NPC {
  name: string;
  description: string;
}

export interface NPCDialogue {
  default: string;
  [flagCondition: string]: string;
}

export type EventScripts = Record<string, string[]>;
export type DialogueMap = Record<string, NPCDialogue>;

export interface World {
  rooms: Record<string, Room>;
  items: Record<string, Item>;
  npcs: Record<string, NPC>;
  events: EventScripts;
  dialogue: DialogueMap;
  startRoom: string;
}
