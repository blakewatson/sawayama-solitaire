import {
  ColorMatrixFilter,
  Container,
  Resource,
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

export default class AceTray extends Container<Card | Sprite> {
  public suit: Suit = Suit.Hearts;

  public constructor(suit: Suit) {
    super();
    this.suit = suit;
    this.eventMode = 'static';

    // create the background placeholder sprite
    const texture: Texture<Resource> =
      store.spritesheet.textures[`${suit}_${Rank.Ace}`];

    const sprite = new Sprite(texture);
    sprite.width = CARD_W;
    sprite.height = CARD_H;
    sprite.alpha = 0.2;

    const filter = new ColorMatrixFilter();
    sprite.filters = [filter];
    filter.desaturate();

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

  public isEmpty() {
    return this.children.length < 2;
  }

  public isFull() {
    return this.children.length > 13;
  }

  public nextCardNeeded() {
    if (this.children.length === 1) {
      return `${this.suit}_${Rank.Ace}`;
    }

    if (this.children.length > 13) {
      return false;
    }

    const topCard = this.children.at(-1) as Card;
    const currentRank = getNumericalRank(topCard.rank);
    const nextRank = Object.values(Rank)[currentRank + 1];
    return `${nextRank}_${this.suit}`;
  }

  public reset() {
    this.children.forEach((card) => {
      if (card instanceof Sprite) {
        return;
      }

      card.removeFromTicker();
      card.destroy();
    });

    this.children.splice(1);
  }
}
