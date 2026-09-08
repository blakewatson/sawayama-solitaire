import { DropShadowFilter } from 'pixi-filters';
import {
  Container,
  FederatedPointerEvent,
  Point,
  Sprite,
  Texture,
  Ticker
} from 'pixi.js';
import PubSub from 'pubsub-js';
import { app } from '../app';
import { GameEvent, Rank, Suit } from '../constants';
import { store } from '../store';

export interface CardClickData {
  card: Card;
  mouseEvent: FederatedPointerEvent;
}

export default class Card extends Container {
  cardSprite: Sprite | null = null;
  clickable = false;
  elevation = 1;
  id = '';
  isHidden = false;
  isTracking = false;

  rank: Rank = Rank.Two;
  suit: Suit = Suit.Hearts;

  // animation params
  velocityX = 0;
  velocityY = 0;
  gravity = 0;

  constructor(rank: Rank, suit: Suit) {
    super();

    // set up the card image
    const texture: Texture = store.spritesheet.textures[`${suit}_${rank}`];

    this.cardSprite = new Sprite(texture);
    this.cardSprite.width = store.layout.CARD_W;
    this.cardSprite.height = store.layout.CARD_H;

    // initial drop shadow
    const shadow = new DropShadowFilter({
      alpha: 0.5,
      blur: 1,
      offset: new Point(0, this.elevation),
      resolution: app.renderer.resolution
    });

    this.filters = [shadow];

    this.addChild(this.cardSprite);

    this.rank = rank;
    this.suit = suit;
    this.id = `${rank}_${suit}`;

    this.eventMode = 'static';

    this.addListener('pointerdown', (event) => {
      PubSub.publish(GameEvent.CARD_CLICK, {
        card: this,
        mouseEvent: event
      });
    });

    Ticker.shared.add(this.update, this);
  }

  removeFromTicker() {
    Ticker.shared.remove(this.update, this);
  }

  update(ticker: Ticker) {
    const dt = ticker.deltaTime;

    this.x += dt * this.velocityX;
    this.y -= dt * this.velocityY;
    this.velocityY -= this.gravity;

    const globalPosition = this.getGlobalPosition();

    const { CARD_H, VIEW_H, VIEW_W } = store.layout;

    if (globalPosition.y + CARD_H > VIEW_H) {
      this.velocityY = Math.abs(this.velocityY / 1.35);
    }

    if (globalPosition.x > VIEW_W + 10) {
      this.isHidden = true;
      this.visible = false;
      this.velocityX = 0;
      this.removeFromTicker();
    }
  }
}
