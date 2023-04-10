import { Graphics } from 'pixi.js';
import Card from './Card';

export default class Cell extends Graphics {
  public card: Card | null = null;
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
    this.beginFill('#00000011');
    this.drawRect(0, 0, width, height);
    this.endFill();
    this.eventMode = 'static';
    this.x = x;
    this.y = y;
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
    this.children.pop();
    return card;
  }
}
