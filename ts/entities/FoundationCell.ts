import { ColorMatrixFilter, Container, Sprite, Texture } from 'pixi.js';
import { FOUNDATION_LABEL, Rank, Suit } from '../constants';
import { store } from '../store';
import { getNumericalRank } from '../utils';
import Card from './Card';
import Cell from './Cell';

type Tray = {
  [key in Suit]: Container<Card | Sprite>;
};

export default class FoundationCell extends Cell {
  public suit: Suit = Suit.Hearts;

  public constructor(suit: Suit, x: number, y: number) {
    super(x, y, FOUNDATION_LABEL, false);
    this.suit = suit;
    this.eventMode = 'static';

    // create the background placeholder sprite
    const texture: Texture = store.spritesheet!.textures[`${suit}_${Rank.Ace}`];

    const sprite = new Sprite(texture);
    sprite.width = store.layout.CARD_W;
    sprite.height = store.layout.CARD_H;
    sprite.alpha = 0.2;

    const filter = new ColorMatrixFilter();
    filter.resolution = window.devicePixelRatio || 1;
    sprite.filters = [filter];
    filter.desaturate();

    this.eventMode = 'static';

    this.addChildAt(sprite, 0);

    this.stack.alignCardsAfterAdding = false;
  }

  public add(card: Card): boolean {
    // if the tray is empty (save the placeholder), allow the ace
    if (this.stack.children.length === 0) {
      if (card.rank === Rank.Ace) {
        this.addCard(card);
        card.x = 0;
        card.y = 0;
        card.eventMode = 'none';
        return true;
      }
      return false;
    }

    const trayTopCard = this.stack.children.at(-1) as Card;
    const trayRank = getNumericalRank(trayTopCard.rank);
    const cardRank = getNumericalRank(card.rank);

    if (cardRank - trayRank === 1) {
      console.log('addCard');
      this.addCard(card);
      card.x = 0;
      card.y = 0;
      card.eventMode = 'none';
      return true;
    }

    console.log('cardRank', cardRank);
    console.log('trayRank', trayRank);
    return false;
  }

  alignCardsVertically() {
    this.stack.children.forEach((card, i) => {
      card.y = 0;
      card.x = 0;
    });
  }

  public isEmpty() {
    return this.stack.children.length < 2;
  }

  public isFull() {
    return this.stack.children.length > 13;
  }

  public nextCardNeeded() {
    if (this.stack.children.length === 0) {
      return `${Rank.Ace}_${this.suit}`;
    }

    if (this.stack.children.length > 12) {
      return false;
    }

    const topCard = this.stack.children.at(-1) as Card;
    const currentRank = getNumericalRank(topCard.rank);
    const nextRank = Object.values(Rank)[currentRank + 1];
    return `${nextRank}_${this.suit}`;
  }

  public reset() {
    this.stack.children.forEach((card) => {
      if (card instanceof Sprite) {
        return;
      }

      card.removeFromTicker();
      card.destroy();
    });

    this.stack.children.splice(1);
  }
}
