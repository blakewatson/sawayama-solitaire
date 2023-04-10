import {
  ColorMatrixFilter,
  Container,
  Resource,
  SCALE_MODES,
  Sprite,
  Texture
} from 'pixi.js';
import { CARD_H, CARD_W, Rank, Suit } from '../constants';
import { store } from '../store';
import { getNumericalRank } from '../utils';
import Card from './Card';

type Tray = {
  [key in Suit]: Container<Card | Sprite>;
};

export default class AceTray extends Container {
  public suit: Suit = Suit.Hearts;

  public constructor(suit: Suit) {
    super();
    this.suit = suit;
    this.eventMode = 'static';

    // create the background placeholder sprite
    const texture: Texture<Resource> =
      store.spritesheet.textures[`${suit}_${Rank.Ace}`];
    texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;

    const sprite = new Sprite(texture);
    sprite.width = CARD_W;
    sprite.height = CARD_H;
    sprite.alpha = 0.2;

    const filter = new ColorMatrixFilter();
    sprite.filters = [filter];
    filter.desaturate();
    filter.contrast(1, true);
    filter.brightness(0.25, true);

    this.eventMode = 'static';

    this.addChild(sprite);
  }

  public add(card: Card): boolean {
    // if the tray is empty (save the placeholder), allow the ace
    if (this.children.length === 1) {
      if (card.rank === Rank.Ace) {
        this.addChild(card);
        card.x = 0;
        card.y = 0;
        card.eventMode = 'none';
        return true;
      }
      return false;
    }

    const trayTopCard = this.children.at(-1) as Card;
    const trayRank = getNumericalRank(trayTopCard.rank);
    const cardRank = getNumericalRank(card.rank);

    if (cardRank - trayRank === 1) {
      this.addChild(card);
      card.x = 0;
      card.y = 0;
      card.eventMode = 'none';
      return true;
    }

    return false;
  }
}
