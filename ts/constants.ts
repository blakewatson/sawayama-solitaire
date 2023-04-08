// Cards
export const BOARD_Y = 165;
export const CARD_W = 85;
export const CARD_H = Math.round(CARD_W * 1.36363636);
export const CARD_OFFSET_VERTICAL = 28;
export const STACK_GAP = 18;
export const ACE_TRAY_W = CARD_W + STACK_GAP * 2;
export const DECK_POS = { x: ACE_TRAY_W + STACK_GAP, y: 35 };

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

// View
export const VIEW_W = ACE_TRAY_W + (CARD_W + STACK_GAP) * 7 + STACK_GAP;
export const VIEW_H = 600;

// Colors
export const COLOR_BG = '#0f62b5';
