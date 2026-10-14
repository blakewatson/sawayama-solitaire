import { Container, Graphics } from 'pixi.js';
import { store } from '../store';
import { cardsAreSequential, stackIsSequential } from '../utils';
import Card from './Card';

export enum StackAlignment {
  HORIZONTAL = 'HORIZONTAL',
  VERTICAL = 'VERTICAL',
  NONE = 'NONE'
}

export default class Stack extends Container<Card> {
  alignCardsAfterAdding = true;
  alignment: StackAlignment = StackAlignment.VERTICAL; // default is vertical
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

  /** Position of the next card if aligned horizontally. */
  get nextCardPosX() {
    return this.alignment === StackAlignment.HORIZONTAL
      ? this.count * store.layout.CARD_OFFSET_HORIZONTAL
      : 0;
  }

  /** Position of the next card if aligned vertically. */
  get nextCardPosY() {
    return this.alignment === StackAlignment.VERTICAL
      ? this.count * store.layout.CARD_OFFSET_VERTICAL
      : 0;
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

  alignCards() {
    if (this.alignment === StackAlignment.HORIZONTAL) {
      return this.alignCardsHorizontally();
    }

    if (this.alignment === StackAlignment.VERTICAL) {
      return this.alignCardsVertically();
    }

    if (this.alignment === StackAlignment.NONE) {
      return this.children.forEach((card) => {
        card.x = 0;
        card.y = 0;
      });
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
