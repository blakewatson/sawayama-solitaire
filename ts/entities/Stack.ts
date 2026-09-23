import { Container, Graphics } from 'pixi.js';
import { store } from '../store';
import { cardsAreSequential, stackIsSequential } from '../utils';
import Card from './Card';

export default class Stack extends Container<Card> {
  alignCardsAfterAdding = true;
  graphics: Graphics = new Graphics();

  constructor(label?: string) {
    super();
    this.label = label;
  }

  get count() {
    return this.children.length;
  }

  get isSequential() {
    return stackIsSequential(this);
  }

  get nextCardPosY() {
    return this.count * store.layout.CARD_OFFSET_VERTICAL;
  }

  get topCard() {
    if (!this.children.length) {
      return null;
    }

    return this.children.at(-1);
  }

  addCards(...cards: Card[]) {
    this.addChild(...cards);

    if (this.alignCardsAfterAdding) {
      this.alignCardsVertically();
    }
  }

  alignCardsHorizontally() {
    this.children.forEach((card, i) => {
      card.x = i * store.layout.CARD_OFFSET_HORIZONTAL;
      card.y = 0;
    });
  }

  alignCardsVertically() {
    this.children.forEach((card, i) => {
      card.y = i * store.layout.CARD_OFFSET_VERTICAL;
      card.x = 0;
    });
  }

  isSequentialFrom(card: Card) {
    const idx = this.children.findIndex((c) => c.label === card.label);
    return cardsAreSequential(this.children.slice(idx));
  }

  popCard() {
    if (!this.children.length) {
      return;
    }

    return this.children.pop();
  }

  sliceFromCard(card: Card) {
    const idx = this.children.findIndex((c) => c.label === card.label);
    const cards = this.children.slice(idx);
    return cards;
  }
}
