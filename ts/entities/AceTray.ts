import {
  ColorMatrixFilter,
  Container,
  Graphics,
  Resource,
  SCALE_MODES,
  Sprite,
  Texture
} from 'pixi.js';
import {
  ACE_TRAY_W,
  CARD_H,
  CARD_W,
  Rank,
  STACK_GAP,
  Suit,
  VIEW_H
} from '../constants';
import { store } from '../store';

type Tray = {
  [key in Suit]: [];
};

export default class AceTray extends Container {
  public tray: Tray = {
    [Suit.Clubs]: [],
    [Suit.Diamonds]: [],
    [Suit.Hearts]: [],
    [Suit.Spades]: []
  };

  constructor() {
    super();
    this.init();
  }

  public init() {
    const bg = new Graphics();
    bg.beginFill('#00000033');
    bg.drawRect(0, 0, ACE_TRAY_W, VIEW_H);
    bg.endFill();
    this.addChild(bg);

    Object.values(Suit).forEach((suit, idx) => {
      const texture: Texture<Resource> =
        store.spritesheet.textures[`${suit}_${Rank.Ace}`];
      texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;

      const sprite = new Sprite(texture);
      sprite.x = STACK_GAP;
      sprite.y = STACK_GAP + idx * (CARD_H + STACK_GAP);
      sprite.width = CARD_W;
      sprite.height = CARD_H;
      sprite.alpha = 0.2;

      const filter = new ColorMatrixFilter();
      sprite.filters = [filter];
      filter.desaturate();
      filter.contrast(1, true);
      filter.brightness(0.25, true);

      this.addChild(sprite);
    });
  }
}
