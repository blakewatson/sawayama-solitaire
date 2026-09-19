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

// View labels
export const BANK_BG = 'BANK_BG';
export const BANK_LABEL = 'BANK';
export const BOARD_CELL_LABEL = 'BOARD_CELL';
export const CARD_LABEL = 'CARD';
export const CELL_STACK_LABEL = 'CELL_STACK';
export const DECK_CELL_LABEL = 'DECK_CELL';
export const DECK_LABEL = 'DECK';
export const HAND_STACK_LABEL = 'HAND_STACK';

export const FOUNDATION_CLUBS_LABEL = 'FOUNDATION_CLUBS';
export const FOUNDATION_DIAMONDS_LABEL = 'FOUNDATION_DIAMONDS';
export const FOUNDATION_HEARTS_LABEL = 'FOUNDATION_HEARTS';
export const FOUNDATION_SPADES_LABEL = 'FOUNDATION_SPADES';

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
export const CARD_ANIM_SPEED_MS = 100;
export const CARD_DRAG_THRESHOLD = 10;
