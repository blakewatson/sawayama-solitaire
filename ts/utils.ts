import Card from './entities/Card';

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
