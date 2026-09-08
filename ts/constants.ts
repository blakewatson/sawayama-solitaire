export enum Suit {
  Clubs = 'clubs',
  Diamonds = 'diamonds',
  Hearts = 'hearts',
  Spades = 'spades'
}

export enum Rank {
  Ace = 'a',
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = '10',
  Jack = 'j',
  Queen = 'q',
  King = 'k'
}

export const BANK_LABEL = 'BANK';
export const BOARD_CELL_LABEL = 'BOARD_CELL';
export const CARD_LABEL = 'CARD';
export const CELL_STACK_LABEL = 'CELL_STACK';
export const DECK_CELL_LABEL = 'DECK_CELL';
export const HAND_STACK_LABEL = 'HAND_STACK';

// View

// export const VIEW_W = 1200;
// export const VIEW_H = 900;

// Colors
export const COLOR_BG = '#505459';

// Events
export enum GameEvent {
  CARD_CLICK = 'CARD_CLICK',
  CELL_CLICK = 'CELL_CLICK',
  RESIZE = 'RESIZE',
  MAIN_SCENE_CLICK = 'MAIN_SCENE_CLICK'
}

// Misc
export const BANK_STACK_ID = 7;
export const DECK_CELL_ID = 8;
export const HAND_STACK_ID = 9;

export const CARD_ANIM_SPEED_MS = 100;
