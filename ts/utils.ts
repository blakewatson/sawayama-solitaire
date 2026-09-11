import { Signal } from '@preact/signals-core';
import { Container } from 'pixi.js';
import { BANK_LABEL, BOARD_CELL_LABEL, Rank, Suit } from './constants';
import AceTray from './entities/AceTray';
import Card from './entities/Card';
import Cell from './entities/Cell';

export const cardsAreSequential = (cards: Card[]) => {
  return cards.every((card, i) => {
    if (!i) {
      return true;
    }

    return isFirstCardAllowedOnSecond(card, cards[i - 1]);
  });
};

export const getCellFromCard = (card: Card): Cell | null => {
  if (card.parent.label === BANK_LABEL) {
    return null;
  }

  return card.parent.parent as Cell;
};

export const getIndexOfSetInStack = (
  stack: Container<Card>,
  card: Card
): number | false => {
  const idx = stack.children.findIndex((c) => c.id === card.id);

  if (idx === -1) {
    return false;
  }

  if (stack.children.at(-1).id === card.id) {
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

export const isCardOnBoard = (card: Card) => {
  if (card.parent.label === BANK_LABEL) {
    return false;
  }

  // If it's not in the bank, then it belongs to a stack which belongs to a cell
  return card.parent.parent.label === BOARD_CELL_LABEL;
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

export const isFoundationEmpty = (foundation: AceTray[]): boolean =>
  foundation.every((tray) => tray.isEmpty());

export const isFoundationFull = (foundation: AceTray[]): boolean =>
  foundation.every((tray) => tray.isFull());

export const isTopCardAnAce = (
  stack: Container<Card>,
  card: Card = null
): boolean => {
  if (card) {
    return card.rank === Rank.Ace;
  }

  return stack.children.at(-1)?.rank === Rank.Ace;
};

export const isTopCardATwo = (
  stack: Container<Card>,
  card: Card = null
): boolean => {
  if (card) {
    return card.rank === Rank.Two;
  }

  return stack.children.at(-1)?.rank === Rank.Two;
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
  stack: Container<Card>,
  foundation: AceTray[],
  card: Card | null = null
): boolean => {
  if (isTopCardAnAce(stack, card)) {
    return true;
  }

  if (isTopCardATwo(stack, card)) {
    const topCard = card || stack.children.at(-1);
    const tray = foundation.find((t) => t.suit === topCard.suit);
    const trayCard = tray.children.at(-1);
    return trayCard instanceof Card && trayCard.rank === Rank.Ace;
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
