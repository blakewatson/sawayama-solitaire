import { Container } from 'pixi.js';
import { CARD_OFFSET_VERTICAL } from '../constants';
import Card from './Card';

export default class Stack extends Container<Card> {
  public constructor() {
    super();
  }

  public addCards(...cards: Card[]) {
    this.addChild(...cards);
    this.alignCards();
  }

  public alignCards() {
    this.children.forEach((card, i) => {
      card.y = i * CARD_OFFSET_VERTICAL;
    });
  }
}
