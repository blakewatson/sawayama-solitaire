import { Container, FederatedPointerEvent, Graphics } from 'pixi.js';
import { CELL_STACK_LABEL } from '../constants';
import { store } from '../store';
import Card from './Card';
import Stack from './Stack';

export interface CellClickData {
  cell: Cell;
  mouseEvent: FederatedPointerEvent;
}

export default class Cell extends Container {
  // card: Card | null = null;
  graphics: Graphics = new Graphics();
  stack: Stack | null = null;

  constructor(
    x: number,
    y: number,
    label: string,
    width?: number,
    height?: number
  ) {
    super();

    width = width || store.layout.CARD_W;
    height = height || store.layout.CARD_H;

    this.label = label;
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

    this.stack = new Stack(CELL_STACK_LABEL + '_' + this.label);
    this.stack.eventMode = 'static';
    this.addChild(this.stack);
  }

  get count() {
    return this.stack.count;
  }

  get nextCardPosY() {
    return this.y + this.stack.nextCardPosY;
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

  getCard(label: string) {
    return this.stack.children.find((c) => c.label === label);
  }

  isSequentialFrom(card: Card) {
    return this.stack.isSequentialFrom(card);
  }

  popCard() {
    return this.stack.popCard();
  }

  reparentCard(...cards: Card[]) {
    return this.stack.reparentChild(...cards);
  }

  sliceFromCard(card: Card) {
    return this.stack.sliceFromCard(card);
  }
}
