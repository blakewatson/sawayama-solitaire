import { Graphics } from 'pixi.js';

export default class Cell extends Graphics {
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
    this.drawRect(x, y, width, height);
    this.endFill();
    this.eventMode = 'static';
  }
}
