import { animate, createTimeline, JSAnimation, stagger } from 'animejs';
import {
  Container,
  ContainerChild,
  Point,
  Sprite,
  Ticker,
  UPDATE_PRIORITY
} from 'pixi.js';
import { CARD_ANIM_SPEED_MS, DECK_LABEL } from '../constants';
import Card from '../entities/Card';
import Cell from '../entities/Cell';
import FoundationCell from '../entities/FoundationCell';
import Stack from '../entities/Stack';
import { store } from '../store';
import {
  getAnimationDurationForPoints,
  isFoundationEmpty,
  rand
} from '../utils';
import ViewController from './ViewController';

const TRAIL_INTERVAL_MS = 1000 / 60;

type TrailState = {
  x: number;
  y: number;
  leftoverMS: number;
};

export default class AnimationController {
  currentAnimation: JSAnimation | null = null;
  isAnimating = false;
  lastSpriteAddedTimeByCard: Record<string, number> = {};
  trailStateByCard: Map<Card, TrailState> = new Map();
  view: ViewController | null = null;
  // winAnimationCards: Card[] = [];

  constructor(view: ViewController) {
    this.view = view;

    Ticker.shared.add(this.update, this, UPDATE_PRIORITY.LOW);
  }

  get isMobile() {
    return this.view.isMobile;
  }

  private addTrailSprite(
    card: Card,
    background: Container,
    x: number,
    y: number
  ) {
    const sprite = Sprite.from(card.cardAsTexture);
    sprite.eventMode = 'none';
    sprite.x = x - 4;
    sprite.y = y - 4;
    background.addChild(sprite);
  }

  bankToCell(bank: Stack, toCell: Cell) {
    return new Promise((resolve, reject) => {
      const scene = this.view.mainScene;

      const card = bank.topCard;

      if (!card) {
        return reject('The bank is empty.');
      }

      // get card position in mainScene space
      const start = scene.toLocal(card.getGlobalPosition());

      // get the target y position relative to toCell.stack
      const y =
        toCell instanceof FoundationCell ? 0 : toCell.stack.nextCardPosY;

      // get the target destination in mainScene space
      const dest = scene.toLocal({ x: 0, y }, toCell.stack);

      // Add cards to a temporary stack for moving
      const mover = new Stack('tmp');
      this.view.addChild(mover);
      mover.x = start.x;
      mover.y = start.y;
      mover.addChild(bank.topCard);

      card.x = 0;
      card.y = 0;

      const animProxy = {
        x: mover.x,
        y: mover.y
      };

      this.isAnimating = true;

      // animate to position
      this.currentAnimation = animate(animProxy, {
        x: dest.x,
        y: dest.y,
        duration: getAnimationDurationForPoints(start, dest),
        ease: 'inOutSine',
        onUpdate: (anim) => {
          mover.x = animProxy.x;
          mover.y = animProxy.y;
        },
        onComplete: () => {
          toCell.addCard(card);
          card.x = 0;
          toCell.alignCardsVertically();
          this.isAnimating = false;
          this.currentAnimation = null;
          resolve(true);
        }
      });
    });
  }

  cellToBank(bank: Stack, fromCell: Cell) {
    return new Promise((resolve, _) => {
      const scene = this.view.mainScene;

      // get card position in mainScene space
      const start = scene.toLocal(fromCell.topCard.getGlobalPosition());

      // get the target x position relative to bank
      const x = bank.nextCardPosX;

      // get the target destination in mainScene space
      const dest = scene.toLocal({ x, y: 0 }, bank);

      // Add cards to a temporary stack for moving
      const mover = new Stack('tmp');
      this.view.addChild(mover);
      mover.x = start.x;
      mover.y = start.y;
      mover.addChild(fromCell.popCard());

      const card = mover.children[0] as Card;
      card.x = 0;
      card.y = 0;

      const animProxy = {
        x: mover.x,
        y: mover.y
      };

      this.isAnimating = true;

      // animate to position
      this.currentAnimation = animate(animProxy, {
        x: dest.x,
        y: dest.y,
        duration: getAnimationDurationForPoints(start, dest),
        ease: 'inOutSine',
        onUpdate: (anim) => {
          mover.x = animProxy.x;
          mover.y = animProxy.y;
        },
        onComplete: () => {
          bank.addCards(card);
          card.y = 0;
          card.x = store.layout.CARD_OFFSET_HORIZONTAL * (bank.count - 1);
          this.isAnimating = false;
          this.currentAnimation = null;
          resolve(true);
        }
      });
    });
  }

  cellToCell(fromCell: Cell, toCell: Cell, cards: Card[]) {
    return new Promise((resolve, reject) => {
      if (!cards.length) {
        return reject('No cards provided');
      }

      const scene = this.view.mainScene;

      // get first card position in mainScene space
      const start = scene.toLocal(cards[0].getGlobalPosition());

      // get the target y position relative to toCell.stack
      const y =
        toCell instanceof FoundationCell ? 0 : toCell.stack.nextCardPosY;

      // get the target destination in mainScene space
      const dest = scene.toLocal({ x: 0, y }, toCell.stack);

      // Add cards to a temporary stack for moving
      const mover = new Stack('tmp');
      this.view.addChild(mover);
      mover.x = start.x;
      mover.y = start.y;
      mover.addChild(...cards);

      // reset local card positions
      mover.alignCardsVertically();

      // We have to animate via an object
      const animProxy = {
        x: mover.x,
        y: mover.y
      };

      this.isAnimating = true;

      // animate to position
      this.currentAnimation = animate(animProxy, {
        x: dest.x,
        y: dest.y,
        duration: getAnimationDurationForPoints(start, dest),
        ease: 'inOutSine',
        onUpdate: (anim) => {
          mover.x = animProxy.x;
          mover.y = animProxy.y;
        },
        onComplete: () => {
          if (toCell instanceof FoundationCell) {
            mover.children[0].removeShadow();
            toCell.addCard(mover.children[0]);
          } else {
            toCell.addCards(...mover.children);
            toCell.alignCardsVertically();
          }

          this.isAnimating = false;
          this.currentAnimation = null;
          resolve(true);
        }
      });
    });
  }

  dealCard(card: Card, cell: Cell) {
    return new Promise((resolve, reject) => {
      // get the length of the deck
      const deckSprites = this.view.mainScene.children.find(
        (child) => child.label === DECK_LABEL
      );

      if (!deckSprites) {
        return reject('deckSprites not found');
      }

      this.view.addChild(card);

      // get the top card
      card.x = store.layout.DECK_POS.x;
      card.y = store.layout.DECK_POS.y - deckSprites.children.length * 0.5;

      // make the deck visibly smaller. TODO: Is this an acceptable side effect?
      deckSprites.children.pop();

      this.isAnimating = true;

      this.currentAnimation = animate(card, {
        x: cell.x,
        y: cell.nextCardPosY,
        ease: 'easeInOutSine',
        duration: getAnimationDurationForPoints(
          new Point(card.x, card.y),
          new Point(cell.x, cell.nextCardPosY),
          1.75
        ),
        onComplete: () => {
          // Remove the card from the main scene
          this.view.removeChild(card);
          cell.addCard(card); // moves the card to new container
          card.x = 0;
          card.y = 0;
          cell.alignCardsVertically();
          card.eventMode = 'static';

          this.isAnimating = false;
          resolve(true);
        }
      });
    });
  }

  deckCascade(deckCards: ContainerChild[]) {
    return new Promise((resolve, reject) => {
      this.isAnimating = true;

      const tl = createTimeline({
        duration: 1000,
        onComplete: () => {
          this.isAnimating = false;
          this.currentAnimation = null;
          resolve(true);
        }
      });

      tl.add(deckCards, {
        y: '-=10',
        duration: 100,
        ease: 'outSine'
      });

      tl.add(deckCards, {
        y: '+=10',
        duration: 100,
        ease: 'outSine',
        delay: stagger(10)
      });
    });
  }

  drawCardFromDeck(card: Card, bankLength: number) {
    return new Promise((resolve, reject) => {
      const deckSprites = this.view.mainScene.children.find(
        (child) => child.label === DECK_LABEL
      );

      if (!deckSprites) {
        return reject('deckSprites not found');
      }

      this.isAnimating = true;

      const x = store.layout.CARD_OFFSET_HORIZONTAL * (bankLength - 1);

      animate(card, {
        x,
        y: 0,
        duration: CARD_ANIM_SPEED_MS,
        ease: 'easeOutSine',
        onChangeBegin: () => {
          deckSprites.removeChildAt(deckSprites.children.length - 1);
        },
        onComplete: () => {
          this.isAnimating = false;
          resolve(true);
        }
      });
    });
  }

  handToBank(bank: Stack, duration = 75) {
    return new Promise((resolve, reject) => {
      // get target position
      const targetPos = bank.getGlobalPosition();
      // get hand position
      const handPos = store.hand.getGlobalPosition();

      // Add cards to a temporary stack for moving
      const mover = new Stack('tmp');
      this.view.addChild(mover);
      mover.x = handPos.x;
      mover.y = handPos.y;
      mover.scale = store.hand.scale;
      mover.addChild(...store.hand.children);

      const card = mover.children[0] as Card;

      const animProxy = {
        x: mover.x,
        y: mover.y,
        scale: 1.15
      };

      this.isAnimating = true;

      // animate to position
      this.currentAnimation = animate(animProxy, {
        x:
          targetPos.x -
          card.x +
          store.layout.CARD_OFFSET_HORIZONTAL * bank.count,
        y: targetPos.y - card.y,
        scale: 1,
        duration,
        ease: 'inOutQuad',
        onUpdate: (anim) => {
          mover.x = animProxy.x;
          mover.y = animProxy.y;
          mover.scale = animProxy.scale;
        },
        onComplete: () => {
          bank.addCards(card);
          card.x = store.layout.CARD_OFFSET_HORIZONTAL * (bank.count - 1);
          card.y = 0;

          store.hand.scale = 1;
          this.view.removeChild(mover);
          mover.destroy();
          this.isAnimating = false;
          this.currentAnimation = null;
          resolve(true);
        }
      });
    });
  }

  handToCell(targetCell: Cell, duration = 75) {
    return new Promise((resolve, reject) => {
      if (this.currentAnimation) {
        this.currentAnimation.seek(this.currentAnimation.duration);
        this.currentAnimation = null;
      }

      // get target position
      const targetPos = targetCell.getGlobalPosition();
      // get hand position
      const handPos = store.hand.getGlobalPosition();

      // Add cards to a temporary stack for moving
      const mover = new Stack('tmp');
      this.view.addChild(mover);
      mover.x = handPos.x;
      mover.y = handPos.y;
      mover.scale = store.hand.scale;
      mover.addChild(...store.hand.children);

      const card = mover.children[0] as Card;

      const animProxy = {
        x: mover.x,
        y: mover.y,
        scale: 1.15
      };

      this.isAnimating = true;

      // animate to position
      this.currentAnimation = animate(animProxy, {
        x: targetPos.x - card.x,
        y:
          targetPos.y -
          card.y +
          store.layout.CARD_OFFSET_VERTICAL * targetCell.count,
        scale: 1,
        duration: 75,
        ease: 'inOutQuad',
        onUpdate: (anim) => {
          mover.x = animProxy.x;
          mover.y = animProxy.y;
          mover.scale = animProxy.scale;
        },
        onComplete: () => {
          targetCell.addCards(...mover.children);
          targetCell.alignCardsVertically();
          store.hand.scale = 1;
          this.view.removeChild(mover);
          mover.destroy();
          this.isAnimating = false;
          this.currentAnimation = null;
          resolve(true);
        }
      });
    });
  }

  handToFoundationCell(cell: FoundationCell) {
    return new Promise((resolve, reject) => {
      // get target position
      const targetPos = cell.getGlobalPosition();
      // get hand position
      const handPos = store.hand.getGlobalPosition();

      // Add cards to a temporary stack for moving
      const mover = new Stack('tmp');
      this.view.addChild(mover);
      mover.x = handPos.x;
      mover.y = handPos.y;
      mover.scale = store.hand.scale;
      mover.addChild(...store.hand.children);

      const card = mover.children[0] as Card;

      const animProxy = {
        x: mover.x,
        y: mover.y,
        scale: 1.15
      };

      this.isAnimating = true;

      // animate to position
      this.currentAnimation = animate(animProxy, {
        x: targetPos.x - card.x,
        y: targetPos.y - card.y,
        scale: 1,
        duration: CARD_ANIM_SPEED_MS,
        ease: 'inOutQuad',
        onUpdate: (anim) => {
          mover.x = animProxy.x;
          mover.y = animProxy.y;
          mover.scale = animProxy.scale;
        },
        onComplete: () => {
          cell.add(card);

          store.hand.scale = 1;
          this.view.removeChild(mover);
          mover.destroy();
          this.isAnimating = false;
          this.currentAnimation = null;
          resolve(true);
        }
      });
    });
  }

  toHand() {
    return new Promise((resolve, _) => {
      console.log('handPos', store.hand.x, store.hand.y);

      const scaleObj = { scale: 1 };

      this.isAnimating = true;

      this.currentAnimation = animate(scaleObj, {
        scale: 1.15,
        ease: 'outBack(4)',
        duration: 200,
        onUpdate: (anim) => {
          store.hand.scale = scaleObj.scale;
        },
        onComplete: () => {
          this.isAnimating = false;
          this.currentAnimation = null;
          resolve(true);
        }
      });
    });
  }

  undoDeckDraw(cards: Card[], onComplete: Function) {
    return new Promise((resolve, _) => {
      this.isAnimating = true;

      this.currentAnimation = animate(cards, {
        x: `-=${store.layout.CARD_W}`,
        y: `-=${store.layout.CARD_H / 6}`,
        alpha: {
          to: 0,
          ease: 'inQuint'
        },
        duration: 150,
        delay: stagger(75),
        ease: 'inQuad',
        onComplete: () => {
          onComplete();
          this.isAnimating = false;
          this.currentAnimation = null;
          resolve(true);
        }
      });
    });
  }

  update(ticker: Ticker) {
    this.view.winAnimationCardLayer.children.forEach((card: Card, i) => {
      let background = this.view.winAnimationBackgroundLayer.children[i];

      if (!background) {
        background = new Container();
        this.view.winAnimationBackgroundLayer.addChild(background);
      }

      if (card.isHidden) {
        if (!background.isCachedAsTexture) {
          background.cacheAsTexture(true);
        }
        this.trailStateByCard.delete(card);
        return;
      }

      let state = this.trailStateByCard.get(card);

      if (!state) {
        this.addTrailSprite(card, background, card.x, card.y);
        this.trailStateByCard.set(card, {
          x: card.x,
          y: card.y,
          leftoverMS: 0
        });
        return;
      }

      const dt = ticker.deltaMS;
      let elapsed = state.leftoverMS + dt;

      while (dt > 0 && elapsed >= TRAIL_INTERVAL_MS) {
        // Where within this tick the next 60 Hz sample belongs.
        const overshoot = elapsed - TRAIL_INTERVAL_MS;
        const fraction = 1 - overshoot / dt;

        const x = state.x + (card.x - state.x) * fraction;
        const y = state.y + (card.y - state.y) * fraction;

        this.addTrailSprite(card, background, x, y);
        elapsed -= TRAIL_INTERVAL_MS;
      }

      state.x = card.x;
      state.y = card.y;
      state.leftoverMS = elapsed;
    });
  }

  async winAnimation(foundation: FoundationCell[]) {
    let count = 0;

    while (!isFoundationEmpty(foundation) && count < 52) {
      const cell = foundation.at(count % 4);

      if (cell.topCard) {
        const card = cell.popCard();
        this.view.winAnimationCardLayer.addChild(card);

        card.x = cell.x;
        card.y = cell.y;
        card.addShadow();
        // card.addGlow();

        if (this.view.isMobile) {
          card.velocityX = rand(0.5, 2) * -1;
          card.velocityY = rand(1.5, 3);
          card.gravity = rand(0.05, 0.15);
        } else {
          card.velocityX = rand(1.5, 4);
          card.velocityY = rand(1.5, 3) * 1 + (count % 4) * 1.1;
          card.gravity = rand(0.05, 0.15);
        }

        await (function () {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve(true);
            }, 4000);
          });
        })();
      }

      count++;
    }
  }
}
