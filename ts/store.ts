import { effect, Signal, signal } from '@preact/signals-core';
import { Spritesheet } from 'pixi.js';
import { BANK_LABEL, Suit } from './constants';
import Card from './entities/Card';
import Cell from './entities/Cell';
import Hand from './entities/Hand';

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
  hand: Hand | null;
  layout: {
    BANK_POS: { x: number; y: number };
    BANK_W: number;
    BOARD_POS: { x: number; y: number };
    CARD_H: number;
    CARD_OFFSET_HORIZONTAL: number;
    CARD_OFFSET_VERTICAL: number;
    CARD_W: number;
    DECK_POS: { x: number; y: number };
    FOUNDATION_BG_POS: { x: number; y: number };
    FOUNDATION_H: number;
    FOUNDATION_W: number;
    STACK_GAP: number;
    VIEW_H: number;
    VIEW_W: number;
  };
  makeDesktopLayout: () => void;
  makeMobileLayout: () => void;
  mousePosition: [number, number];
  moves: Signal<GameMove[]>;
  movesCache: Signal<GameMove[]>;
  spritesheet: Spritesheet | null;
}

// Cards

export const store: IStore = {
  hand: null,
  layout: {
    BANK_POS: { x: 0, y: 0 },
    BANK_W: 0,
    BOARD_POS: { x: 0, y: 0 },
    CARD_H: 0,
    CARD_OFFSET_HORIZONTAL: 0,
    CARD_OFFSET_VERTICAL: 0,
    CARD_W: 0,
    DECK_POS: { x: 0, y: 0 },
    // The position of the foundation background
    FOUNDATION_BG_POS: { x: 0, y: 0 },
    FOUNDATION_H: 0,
    FOUNDATION_W: 0,
    STACK_GAP: 0,
    VIEW_H: 0,
    VIEW_W: 0
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

    store.layout.FOUNDATION_W =
      store.layout.CARD_W + store.layout.STACK_GAP * 2;

    store.layout.FOUNDATION_BG_POS = {
      x: 0,
      y: 0
    };

    store.layout.VIEW_W =
      store.layout.FOUNDATION_W +
      (store.layout.CARD_W + store.layout.STACK_GAP) * 7 +
      store.layout.STACK_GAP;

    store.layout.VIEW_H =
      (store.layout.STACK_GAP + store.layout.CARD_H) * 4 +
      store.layout.STACK_GAP * 3;

    store.layout.FOUNDATION_H = store.layout.VIEW_H;

    store.layout.DECK_POS = {
      x: store.layout.FOUNDATION_W + store.layout.STACK_GAP,
      y: 35
    };

    store.layout.BANK_POS = {
      x: store.layout.DECK_POS.x + store.layout.CARD_W + store.layout.STACK_GAP,
      y: store.layout.DECK_POS.y
    };

    store.layout.BANK_W =
      store.layout.VIEW_W - store.layout.BANK_POS.x - store.layout.STACK_GAP;

    store.layout.BOARD_POS = {
      x: store.layout.DECK_POS.x,
      y:
        store.layout.STACK_GAP +
        store.layout.STACK_GAP / 2 +
        store.layout.CARD_H +
        store.layout.STACK_GAP
    };
  },

  makeMobileLayout() {
    store.layout.CARD_W = 50;
    store.layout.CARD_H = Math.round(store.layout.CARD_W * 1.33333333);
    store.layout.CARD_OFFSET_VERTICAL = store.layout.CARD_H / 3;
    store.layout.CARD_OFFSET_HORIZONTAL = store.layout.CARD_W / 2.75;
    store.layout.STACK_GAP = 10;

    store.layout.VIEW_W =
      (store.layout.CARD_W + store.layout.STACK_GAP) * 7 +
      store.layout.STACK_GAP * 7;

    store.layout.FOUNDATION_BG_POS = {
      x: 0,
      y: store.layout.STACK_GAP
    };

    store.layout.FOUNDATION_W = store.layout.VIEW_W;
    store.layout.FOUNDATION_H =
      store.layout.CARD_H + store.layout.STACK_GAP * 2;

    store.layout.DECK_POS = {
      x: store.layout.STACK_GAP,
      y: store.layout.STACK_GAP + store.layout.FOUNDATION_BG_POS.y
    };

    store.layout.BANK_POS = {
      x: store.layout.DECK_POS.x,
      y:
        store.layout.FOUNDATION_H +
        store.layout.FOUNDATION_BG_POS.y +
        store.layout.STACK_GAP
    };

    store.layout.BANK_W = store.layout.VIEW_W - store.layout.STACK_GAP * 2;

    store.layout.BOARD_POS = {
      x: store.layout.STACK_GAP * 4,
      y:
        store.layout.FOUNDATION_BG_POS.y +
        store.layout.FOUNDATION_H +
        store.layout.STACK_GAP +
        store.layout.CARD_H +
        store.layout.STACK_GAP
    };

    store.layout.VIEW_H =
      store.layout.FOUNDATION_H +
      store.layout.STACK_GAP +
      store.layout.CARD_H +
      store.layout.STACK_GAP +
      store.layout.CARD_H * 5;
  }
};

function formatCards(cards: Card[]) {
  return cards.map((card) => card.label).join(', ');
}

function formatMove(move: GameMove) {
  switch (move.type) {
    case MoveType.BANK_MOVE:
      return `BANK_MOVE: ${BANK_LABEL || 'container'} -> cell ${move.to.label}`;
    case MoveType.DECK_DRAW:
      return `DECK_DRAW: ${formatCards(move.cards)}`;
    case MoveType.CELL_MOVE:
      return `CELL_MOVE: cell ${move.from.label} -> cell ${
        move.to.label
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
