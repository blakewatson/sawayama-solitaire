import { Container, Graphics } from 'pixi.js';
import Card from './Card';

export default class Cell extends Container {
  public card: Card | null = null;
  public graphics: Graphics = new Graphics();
  public id: number = 0;

  public constructor(
    id: number,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    super();
    this.id = id;
    this.graphics.rect(0, 0, width, height);
    this.graphics.fill('#00000011');
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
  }

  public addCard(card: Card) {
    this.card = card;
    this.addChild(this.card);
    this.card.x = 0;
    this.card.y = 0;
  }

  public removeCard() {
    if (!this.card) {
      return;
    }
    const card = this.card;
    this.card = null;
    this.children.unshift();
    return card;
  }
}
