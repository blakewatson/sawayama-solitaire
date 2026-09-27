import { DropShadowFilter } from 'pixi-filters';
import { Container, Point, Rectangle, Sprite, Texture, Ticker } from 'pixi.js';
import { app } from '../app';
import { Rank, Suit } from '../constants';
import { store } from '../store';

export interface CardClickData {
  card: Card;
  mouseX: number;
  mouseY: number;
}

export default class Card extends Container {
  cardSprite: Sprite | null = null;
  clickable = false;
  elevation = 1;
  isHidden = false;
  isTracking = false;
  shadow: DropShadowFilter | null = null;
  snapshotTexture: Texture | null = null;

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
    this.shadow = new DropShadowFilter({
      alpha: 0.5,
      blur: 1,
      offset: new Point(0, this.elevation),
      resolution: app.renderer.resolution
    });

    this.addShadow();

    this.addChild(this.cardSprite);

    this.rank = rank;
    this.suit = suit;
    this.label = `${rank}_${suit}`;

    this.eventMode = 'static';

    Ticker.shared.add(this.update, this);
  }

  get cardAsTexture() {
    if (this.snapshotTexture) {
      return this.snapshotTexture;
    }

    const copy = new Sprite(this.cardSprite?.texture);
    copy.width = store.layout.CARD_W;
    copy.height = store.layout.CARD_H;
    copy.filters = this.shadow ? [this.shadow] : [];

    const snapshot = new Container();
    snapshot.addChild(copy);

    const pad = 4; // room for the shadow beyond the card edges
    this.snapshotTexture = app.renderer.generateTexture({
      target: snapshot,
      frame: new Rectangle(
        -pad,
        -pad,
        store.layout.CARD_W + 2 * pad,
        store.layout.CARD_H + 2 * pad
      )
    });
    return this.snapshotTexture;
  }

  addShadow() {
    if (!this.filters?.includes(this.shadow)) {
      this.filters = [...(this.filters || []), this.shadow];
    }
  }

  removeFromTicker() {
    Ticker.shared.remove(this.update, this);
  }

  removeShadow() {
    this.filters = null;
  }

  update(ticker: Ticker) {
    const dt = ticker.deltaTime;

    if (!this.velocityX && !this.velocityY) {
      return;
    }

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
