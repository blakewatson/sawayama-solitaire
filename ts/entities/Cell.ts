import { Container, Graphics } from 'pixi.js';
import { store } from '../store';
import Card from './Card';
import Stack from './Stack';

export default class Cell extends Container {
  // card: Card | null = null;
  graphics: Graphics = new Graphics();
  id: number = 0;
  stack: Stack | null = null;

  constructor(
    id: number,
    x: number,
    y: number,
    width?: number,
    height?: number
  ) {
    super();

    width = width || store.layout.CARD_W;
    height = height || store.layout.CARD_H;

    this.id = id;
    this.graphics.rect(0, 0, width, height);
    this.graphics.fill('#00000022');
    this.graphics.x = 0;
    this.graphics.y = 0;
    this.graphics.width = width;
    this.graphics.height = height;
    this.eventMode = 'static';
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.addChild(this.graphics);

    this.stack = new Stack(this.id);
    this.stack.eventMode = 'static';
    this.addChild(this.stack);
  }

  get count() {
    return this.stack.children.length;
  }

  get nextCardPosY() {
    return this.y + store.layout.CARD_OFFSET_VERTICAL * this.count;
  }

  addCard(card: Card) {
    this.stack.addCards(card);
  }

  addCards(...cards: Card[]) {
    this.stack.addCards(...cards);
  }

  alignCards() {
    this.stack.alignCards();
  }

  popCard() {
    if (!this.stack.children.length) {
      return;
    }
    const card = this.stack.children.pop();
    // this.removeChild(card);
    return card;
  }
}
