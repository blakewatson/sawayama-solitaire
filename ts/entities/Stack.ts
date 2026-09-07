import { Container } from 'pixi.js';
import { store } from '../store';
import Card from './Card';

export default class Stack extends Container<Card> {
  id = 0;

  constructor(id: number) {
    super();
    this.id = id;
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
}
