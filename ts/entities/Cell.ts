import { Container, FederatedPointerEvent, Graphics } from 'pixi.js';
import { CELL_STACK_LABEL, GameEvent } from '../constants';
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
  id: number = 0;
  stack: Stack | null = null;

  constructor(
    id: number,
    x: number,
    y: number,
    label?: string,
    width?: number,
    height?: number
  ) {
    super();

    width = width || store.layout.CARD_W;
    height = height || store.layout.CARD_H;

    this.id = id;
    this.label = label || id.toString();
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

    this.stack = new Stack(this.id, CELL_STACK_LABEL);
    this.stack.eventMode = 'static';
    this.addChild(this.stack);

    this.addEventListener('pointertap', (event) => {
      PubSub.publish(GameEvent.CELL_CLICK, {
        cell: this,
        mouseEvent: event
      });
    });
  }

  get count() {
    return this.stack.count;
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

  getCard(id: string) {
    return this.stack.children.find((c) => c.id === id);
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

  takeFrom(card: Card) {
    return this.stack.takeFrom(card);
  }
}
