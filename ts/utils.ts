import { Signal } from '@preact/signals-core';
import { Container, Point } from 'pixi.js';
import {
  BANK_BG,
  BANK_LABEL,
  BOARD_CELL_LABEL,
  CARD_ANIM_SPEED_MS,
  Rank,
  Suit
} from './constants';
import Card from './entities/Card';
import Cell from './entities/Cell';
import FoundationCell from './entities/FoundationCell';
import Stack from './entities/Stack';
import { GameMove, GameState, LocationRef, MoveType } from './store';

export const cardsAreSequential = (cards: Card[]) => {
  if (cards.length < 2) {
    return true;
  }

  return cards.every((card, i) => {
    if (!i) {
      return true;
    }

    return isFirstCardAllowedOnSecond(card, cards[i - 1]);
  });
};

export const getAnimationDurationForDistance = (
  distance: number,
  multiplier = 1
) => {
  // The constant is being treated as a minimum animation speed
  const durationMs = CARD_ANIM_SPEED_MS + 100 * Math.sqrt(distance / 600);
  return durationMs / multiplier;
};

export const getAnimationDurationForPoints = (
  a: Point,
  b: Point,
  multiplier = 1
) => getAnimationDurationForDistance(getDistance(a, b), multiplier);

export const getCellFromCard = (card: Card): Cell | null => {
  if (card.parent.label === BANK_LABEL) {
    return null;
  }

  return card.parent.parent as Cell;
};

export const getChildByLabel = (parent: Container, label: string) => {
  return (
    parent.children.find((child) => child.label && child.label === label) ||
    null
  );
};

export const getDistance = (a: Point, b: Point) => {
  const side1 = a.x - b.x;
  const side2 = a.y - b.y;
  // return Math.sqrt(side1 ** 2 + side2 ** 2);
  return Math.hypot(side1, side2);
};

export const getFoundationCell = (suit: Suit, foundation: FoundationCell[]) =>
  foundation.find((cell) => cell.suit === suit);

export const getIndexOfSetInStack = (
  stack: Container<Card>,
  card: Card
): number | false => {
  const idx = stack.children.findIndex((c) => c.label === card.label);

  if (idx === -1) {
    return false;
  }

  if (stack.children.at(-1).label === card.label) {
    return idx;
  }

  for (let i = idx; i < stack.children.length - 1; i++) {
    // if the next card is part of a set, continue. if we make it to the end,
    // return the set. else return false
    if (
      isFirstCardAllowedOnSecond(stack.children.at(i + 1), stack.children.at(i))
    ) {
      continue;
    }

    return false;
  }

  return idx;
};

export const getNumericalRank = (rank: Rank): number =>
  Object.values(Rank).findIndex((r) => r === rank);

// Given a target object, returns the underlying cell if one exists.
export const getTargetCell = (obj: Cell | Card | Container) => {
  if (obj instanceof Card) {
    return getCellFromCard(obj);
  }

  if (obj instanceof Cell) {
    return obj;
  }

  if (obj instanceof FoundationCell) {
    return obj;
  }

  return null;
};

export const isBankObj = (obj: Container) =>
  obj.label === BANK_LABEL ||
  obj.label === BANK_BG ||
  obj.parent.label === BANK_LABEL;

export const isCardOnBoard = (card: Card) => {
  if (card.parent.label === BANK_LABEL) {
    return false;
  }

  // If it's not in the bank, then it belongs to a stack which belongs to a cell
  return card.parent.parent.label.startsWith(BOARD_CELL_LABEL);
};

export const isFirstCardAllowedOnSecond = (card1: Card, card2: Card) => {
  let suitsMatch =
    ((card1.suit === Suit.Clubs || card1.suit === Suit.Spades) &&
      (card2.suit === Suit.Hearts || card2.suit === Suit.Diamonds)) ||
    ((card1.suit === Suit.Hearts || card1.suit === Suit.Diamonds) &&
      (card2.suit === Suit.Clubs || card2.suit === Suit.Spades));

  const rank2 = getNumericalRank(card2.rank);
  const rank1 = getNumericalRank(card1.rank);

  return suitsMatch && rank2 - rank1 === 1;
};

export const isFoundationEmpty = (foundation: FoundationCell[]): boolean =>
  foundation.every((cell) => cell.isEmpty());

export const isFoundationFull = (foundation: FoundationCell[]): boolean =>
  foundation.every((cell) => cell.isFull());

export const isTopCardAnAce = (stack: Stack): boolean => {
  return stack.topCard?.rank === Rank.Ace;
};

export const isTopCardATwo = (stack: Stack): boolean => {
  return stack.topCard?.rank === Rank.Two;
};

export const signalPop = (arrSignal: Signal<Array<any>>) => {
  const item = arrSignal.value.at(-1);
  arrSignal.value = arrSignal.value.slice(0, -1);
  return item;
};

export const signalPush = (arrSignal: Signal<Array<any>>, item: any) => {
  arrSignal.value = [...arrSignal.value, item];
};

export const rand = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

export const shouldAutoMoveTopCard = (
  cellOrStack: Cell | Stack,
  foundation: FoundationCell[]
): boolean => {
  const stack = cellOrStack instanceof Cell ? cellOrStack.stack : cellOrStack;

  if (!stack.topCard) {
    return false;
  }

  if (isTopCardAnAce(stack)) {
    return true;
  }

  if (isTopCardATwo(stack)) {
    const topCard = stack.children.at(-1);
    const cell = foundation.find((t) => t.suit === topCard.suit);
    const cellCard = cell.topCard;
    return cellCard instanceof Card && cellCard.rank === Rank.Ace;
  }
};

export function shuffleCards(cards: Card[]): Card[] {
  // Create a copy of the original array to avoid modifying it directly
  const shuffledCards = [...cards];

  // Perform a Fisher-Yates shuffle algorithm
  for (let i = shuffledCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledCards[i], shuffledCards[j]] = [shuffledCards[j], shuffledCards[i]];
  }

  return shuffledCards;
}

export const stackIsSequential = (stack: Container<Card>): boolean =>
  cardsAreSequential(stack.children);

// State compression

export const smushCardId = (id: string) => id.substring(0, id.indexOf('_') + 2);
export const smushCardIds = (ids: string[]) => ids.map(smushCardId);

type SuitCode = 'c' | 'd' | 'h' | 's';

type SmushedLocationRef = `b${number}` | `f${SuitCode}` | 'd' | 'k';

type SmushedBankLocationRef = 'k';

type SmushedNonBankLocationRef = Exclude<SmushedLocationRef, 'k'>;

type GameMoveSmushed =
  | ['d', string[]]
  | ['b', string[], SmushedBankLocationRef, SmushedNonBankLocationRef]
  | ['c', string[], SmushedNonBankLocationRef, SmushedNonBankLocationRef];

export const smushLocationRef = (ref: LocationRef): SmushedLocationRef => {
  switch (ref.kind) {
    case 'bank':
      return 'k';
    case 'deckCell':
      return 'd';
    case 'board':
      return `b${ref.index}`;
    case 'foundation':
      return `f${ref.suit[0]}` as SmushedLocationRef;
  }
};

export const unsmushLocationRef = (ref: SmushedLocationRef): LocationRef => {
  if (ref === 'k') {
    return { kind: 'bank' };
  }

  if (ref === 'd') {
    return { kind: 'deckCell' };
  }

  if (ref.startsWith('b')) {
    const index = parseInt(ref.substring(1));
    return { kind: 'board', index };
  }

  if (ref.startsWith('f')) {
    const suitCode = ref[1] as SuitCode;
    const suitMap: Record<SuitCode, Suit> = {
      c: Suit.Clubs,
      d: Suit.Diamonds,
      h: Suit.Hearts,
      s: Suit.Spades
    };
    return { kind: 'foundation', suit: suitMap[suitCode] };
  }
};

export const smushMoves = (moves: GameMove[]) =>
  moves.map((move): GameMoveSmushed => {
    if (move.type === MoveType.DECK_DRAW) {
      return ['d', smushCardIds(move.cardIds)];
    }

    return [
      move.type === MoveType.BANK_MOVE ? 'b' : 'c',
      smushCardIds(move.cardIds),
      smushLocationRef(move.from),
      smushLocationRef(move.to)
    ] as GameMoveSmushed;
  });

export const smushGameState = (state: GameState) => ({
  bank: smushCardIds(state.bank),
  board: state.board.map((row) => smushCardIds(row)),
  deck: smushCardIds(state.deck),
  deckCell: smushCardId(state.deckCell),
  foundation: {
    [Suit.Clubs]: smushCardIds(state.foundation[Suit.Clubs]),
    [Suit.Diamonds]: smushCardIds(state.foundation[Suit.Diamonds]),
    [Suit.Hearts]: smushCardIds(state.foundation[Suit.Hearts]),
    [Suit.Spades]: smushCardIds(state.foundation[Suit.Spades])
  },
  moves: smushMoves(state.moves),
  movesCache: smushMoves(state.movesCache)
});

export const unsmushCardId = (id: string) => {
  const end = id.slice(-2);
  const rank = id.replace(end, '');

  switch (end) {
    case '_c':
      return `${rank}_clubs`;
    case '_d':
      return `${rank}_diamonds`;
    case '_h':
      return `${rank}_hearts`;
    case '_s':
      return `${rank}_spades`;
  }
};

export const unsmushCardIds = (ids: string[]) => ids.map(unsmushCardId);

export const unsmushMove = (move: GameMoveSmushed): GameMove => {
  const cardIds = unsmushCardIds(move[1]);

  if (move[0] === 'd') {
    return { type: MoveType.DECK_DRAW, cardIds };
  }

  return {
    type: move[0] === 'b' ? MoveType.BANK_MOVE : MoveType.CELL_MOVE,
    cardIds,
    from: unsmushLocationRef(move[2]),
    to: unsmushLocationRef(move[3])
  } as GameMove; // because life is too short
};

export const unsmushMoves = (moves: GameMoveSmushed[]): GameMove[] =>
  moves.map(unsmushMove);

export const unsmushGameState = (
  state: ReturnType<typeof smushGameState>
): GameState => ({
  bank: unsmushCardIds(state.bank),
  board: state.board.map((row) => unsmushCardIds(row)),
  deck: unsmushCardIds(state.deck),
  deckCell: unsmushCardId(state.deckCell),
  foundation: {
    [Suit.Clubs]: unsmushCardIds(state.foundation[Suit.Clubs]),
    [Suit.Diamonds]: unsmushCardIds(state.foundation[Suit.Diamonds]),
    [Suit.Hearts]: unsmushCardIds(state.foundation[Suit.Hearts]),
    [Suit.Spades]: unsmushCardIds(state.foundation[Suit.Spades])
  },
  moves: unsmushMoves(state.moves),
  movesCache: unsmushMoves(state.movesCache)
});
