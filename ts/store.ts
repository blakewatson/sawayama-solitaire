import { effect, Signal, signal } from '@preact/signals-core';
import { Spritesheet } from 'pixi.js';
import { BANK_LABEL, Suit } from './constants';
import Card from './entities/Card';
import Cell from './entities/Cell';

export enum MoveType {
  BANK_MOVE = 'BANK_MOVE',
  DECK_DRAW = 'DECK_DRAW',
  CELL_MOVE = 'CELL_MOVE'
}

interface BaseMove {
  type: MoveType;
}

export type BankMove = BaseMove & {
  type: MoveType.BANK_MOVE;
  to: Cell;
};

export type DeckDraw = BaseMove & {
  type: MoveType.DECK_DRAW;
  cards: Card[];
};

export type CellMove = BaseMove & {
  type: MoveType.CELL_MOVE;
  cards: Card[];
  from: Cell;
  to: Cell;
};

export type GameMove = BankMove | DeckDraw | CellMove;

interface GameState {
  bank: string[];
  deck: string[];
  foundation: {
    [Suit.Clubs]: string[];
    [Suit.Diamonds]: string[];
    [Suit.Hearts]: string[];
    [Suit.Spades]: string[];
  };
  stacks: string[][];
}

interface IStore {
  layout: {
    CARD_W: number;
    CARD_H: number;
    CARD_OFFSET_VERTICAL: number;
    CARD_OFFSET_HORIZONTAL: number;
    STACK_GAP: number;
    ACE_TRAY_W: number;
    ACE_TRAY_H: number;
    DECK_POS: { x: number; y: number };
    BOARD_Y: number;
    VIEW_W: number;
    VIEW_H: number;
  };
  mousePosition: [number, number];
  moves: Signal<GameMove[]>;
  movesCache: Signal<GameMove[]>;
  spritesheet: Spritesheet | null;
  makeDesktopLayout: () => void;
}

// Cards

export const store: IStore = {
  layout: {
    CARD_W: 0,
    CARD_H: 0,
    CARD_OFFSET_VERTICAL: 0,
    CARD_OFFSET_HORIZONTAL: 0,
    STACK_GAP: 0,
    ACE_TRAY_W: 0,
    ACE_TRAY_H: 0,
    DECK_POS: { x: 0, y: 0 },
    BOARD_Y: 0,
    VIEW_W: 0,
    VIEW_H: 0
  },
  mousePosition: [0, 0],
  moves: signal([]),
  movesCache: signal([]),
  spritesheet: null,
  makeDesktopLayout() {
    store.layout.CARD_W = 90;
    store.layout.CARD_H = Math.round(store.layout.CARD_W * 1.33333333);
    store.layout.CARD_OFFSET_VERTICAL = store.layout.CARD_H / 4.75;
    store.layout.CARD_OFFSET_HORIZONTAL = store.layout.CARD_W / 4.25;
    store.layout.STACK_GAP = 18;

    store.layout.ACE_TRAY_W = store.layout.CARD_W + store.layout.STACK_GAP * 2;

    store.layout.VIEW_W =
      store.layout.ACE_TRAY_W +
      (store.layout.CARD_W + store.layout.STACK_GAP) * 7 +
      store.layout.STACK_GAP;

    store.layout.VIEW_H =
      (store.layout.STACK_GAP + store.layout.CARD_H) * 4 +
      store.layout.STACK_GAP * 3;

    store.layout.ACE_TRAY_H = store.layout.VIEW_H;

    store.layout.DECK_POS = {
      x: store.layout.ACE_TRAY_W + store.layout.STACK_GAP,
      y: 35
    };

    store.layout.BOARD_Y =
      store.layout.STACK_GAP +
      store.layout.STACK_GAP / 2 +
      store.layout.CARD_H +
      store.layout.STACK_GAP;
  }
};

function formatCards(cards: Card[]) {
  return cards.map((card) => card.id).join(', ');
}

function formatMove(move: GameMove) {
  switch (move.type) {
    case MoveType.BANK_MOVE:
      return `BANK_MOVE: ${BANK_LABEL || 'container'} -> cell ${move.to.id}`;
    case MoveType.DECK_DRAW:
      return `DECK_DRAW: ${formatCards(move.cards)}`;
    case MoveType.CELL_MOVE:
      return `CELL_MOVE: cell ${move.from.id} -> cell ${
        move.to.id
      } (${formatCards(move.cards)})`;
  }
}

function logMoves(label: string, moves: GameMove[]) {
  console.group(`${label} (${moves.length})`);

  if (!moves.length) {
    console.log('• (empty)');
  } else {
    moves.forEach((move, index) => {
      console.log(`• ${index + 1}. ${formatMove(move)}`);
    });
  }

  console.groupEnd();
}

effect(() => {
  logMoves('moves', store.moves.value);
});

effect(() => {
  logMoves('movesCache', store.movesCache.value);
});

// @ts-ignore
window.store = store;
