import {
  Application,
  Color,
  SCALE_MODES,
  Sprite,
  Spritesheet,
  Ticker
} from 'pixi.js';
import { IAssets } from './app';
import { COLOR_BG, VIEW_H, VIEW_W } from './constants';
import deckData from './deckData';

export default class Game {
  public app: Application | null = null;
  public graphics: IAssets | null = null;
  public ticker: Ticker | null = null;

  constructor(graphics: IAssets, ticker: Ticker) {
    this.app = new Application({
      width: VIEW_W,
      height: VIEW_H,
      resolution: window.devicePixelRatio || 1,
      backgroundColor: new Color(COLOR_BG).toNumber()
    });

    this.graphics = graphics;
    this.ticker = ticker;

    document
      .querySelector('#board')
      ?.append(this.app.view as HTMLCanvasElement);

    const spritesheet = new Spritesheet(this.graphics.deck, deckData);

    spritesheet.parse().then(() => {
      const texture = spritesheet.textures['hearts_k'];
      texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
      const card = new Sprite(texture);
      card.width = 132;
      card.height = 180;
      this.app?.stage.addChild(card);
    });
  }
}
