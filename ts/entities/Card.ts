import {
  Container,
  FederatedPointerEvent,
  Resource,
  Sprite,
  Texture
} from 'pixi.js';
import PubSub from 'pubsub-js';
import { CARD_H, CARD_W, GameEvent, Rank, Suit } from '../constants';
import { store } from '../store';

export interface CardClickData {
  card: Card;
  mouseEvent: FederatedPointerEvent;
}

export default class Card extends Container {
  public cardSprite: Sprite | null = null;
  public id: string = '';
  public isTracking: boolean = false;
  public ogX: number = 0;
  public ogY: number = 0;
  public rank: Rank = Rank.Two;
  public suit: Suit = Suit.Hearts;

  public constructor(rank: Rank, suit: Suit) {
    super();
    const texture: Texture<Resource> =
      store.spritesheet.textures[`${suit}_${rank}`];

    this.cardSprite = new Sprite(texture);
    this.cardSprite.width = CARD_W;
    this.cardSprite.height = CARD_H;
    // this.cardSprite.anchor.set(0.5);

    this.ogX = this.x;
    this.ogY = this.y;

    this.addChild(this.cardSprite);

    this.rank = rank;
    this.suit = suit;
    this.id = `${rank}_${suit}`;

    let offset = [0, 0];

    this.eventMode = 'static';

    this.addListener('pointertap', (event) => {
      PubSub.publish(GameEvent.CARD_CLICK, {
        card: this,
        mouseEvent: event
      });
    });

    // this.addListener('pointertap', (event) => {
    //   if (store.cardInHand && store.cardInHand !== this) {
    //     return;
    //   }

    //   if (!this.isTracking) {
    //     // tracking this offset allows the card to be grabbed from anywhere
    //     // without making it jump straight to the mouse position
    //     offset[0] = event.globalX - this.x;
    //     offset[1] = event.globalY - this.y;
    //     // for right now save the original position of the card (future:
    //     // probably allow it to go to any valid spots)
    //     this.ogX = this.x;
    //     this.ogY = this.y;
    //     // make the store aware
    //     store.cardInHand = this;
    //   } else {
    //     offset[0] = 0;
    //     this.x = this.ogX;
    //     this.y = this.ogY;
    //     store.cardInHand = null;
    //   }

    //   this.isTracking = !this.isTracking;
    // });

    // Ticker.shared.add(() => {
    //   if (this.isTracking) {
    //     this.x = store.mousePosition[0] - offset[0];
    //     this.y = store.mousePosition[1] - offset[1];
    //     return;
    //   }
    // });
  }
}
