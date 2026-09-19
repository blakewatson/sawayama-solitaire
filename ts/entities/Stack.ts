import { Container, Graphics } from 'pixi.js';
import { store } from '../store';
import { cardsAreSequential, stackIsSequential } from '../utils';
import Card from './Card';

export default class Stack extends Container<Card> {
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

  addCards(...cards: Card[]) {
    this.addChild(...cards);
    this.alignCards();
  }

  alignCards() {
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
