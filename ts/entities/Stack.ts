import { Container } from 'pixi.js';
import { CARD_OFFSET_VERTICAL } from '../constants';
import Card from './Card';

export default class Stack extends Container<Card> {
  public id = 0;

  public constructor(id: number) {
    super();
    this.id = id;
  }

  public addCards(...cards: Card[]) {
    this.addChild(...cards);
    this.alignCards();
  }

  public alignCards() {
    this.children.forEach((card, i) => {
      card.y = i * CARD_OFFSET_VERTICAL;
      card.x = 0;
    });
  }
}
