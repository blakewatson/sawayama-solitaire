import {
  Container,
  FederatedPointerEvent,
  Sprite,
  Texture,
  Ticker
} from 'pixi.js';
import PubSub from 'pubsub-js';
import {
  CARD_H,
  CARD_W,
  GameEvent,
  Rank,
  Suit,
  VIEW_H,
  VIEW_W
} from '../constants';
import { store } from '../store';

export interface CardClickData {
  card: Card;
  mouseEvent: FederatedPointerEvent;
}

export default class Card extends Container {
  public cardSprite: Sprite | null = null;
  public clickable = false;
  public id = '';
  public isHidden = false;
  public isTracking = false;

  public rank: Rank = Rank.Two;
  public suit: Suit = Suit.Hearts;

  // animation params
  public velocityX = 0;
  public velocityY = 0;
  public gravity = 0;

  public constructor(rank: Rank, suit: Suit) {
    super();
    const texture: Texture = store.spritesheet.textures[`${suit}_${rank}`];

    this.cardSprite = new Sprite(texture);
    this.cardSprite.width = CARD_W;
    this.cardSprite.height = CARD_H;

    this.addChild(this.cardSprite);

    this.rank = rank;
    this.suit = suit;
    this.id = `${rank}_${suit}`;

    this.eventMode = 'none';

    this.addListener('pointerdown', (event) => {
      PubSub.publish(GameEvent.CARD_CLICK, {
        card: this,
        mouseEvent: event
      });
    });

    Ticker.shared.add(this.update, this);
  }

  public removeFromTicker() {
    Ticker.shared.remove(this.update, this);
  }

  public update(ticker: Ticker) {
    const dt = ticker.deltaTime;

    this.x += dt * this.velocityX;
    this.y -= dt * this.velocityY;
    this.velocityY -= this.gravity;

    const globalPosition = this.getGlobalPosition();

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
