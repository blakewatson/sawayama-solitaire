import { Container } from 'pixi.js';
import { Rank, Suit } from './constants';
import Card from './entities/Card';

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

export const isFirstCardAllowedOnSecond = (card1: Card, card2: Card) => {
  let suitsMatch =
    ((card1.suit === Suit.Clubs || card1.suit === Suit.Spades) &&
      (card2.suit === Suit.Hearts || card2.suit === Suit.Diamonds)) ||
    ((card1.suit === Suit.Hearts || card1.suit === Suit.Diamonds) &&
      (card2.suit === Suit.Clubs || card2.suit === Suit.Spades));

  const rank2 = Object.values(Rank).findIndex((r) => r === card2.rank);
  const rank1 = Object.values(Rank).findIndex((r) => r === card1.rank);

  return suitsMatch && rank2 - rank1 === 1;
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
