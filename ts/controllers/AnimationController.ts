import {
  animate,
  AnimationParams,
  createTimeline,
  JSAnimation,
  stagger,
  Timeline
} from 'animejs';
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
  activeAnimations: Array<JSAnimation | Timeline> = [];
  disabled = false;
  isWinAnimation = false;
  lastSpriteAddedTimeByCard: Record<string, number> = {};
  trailStateByCard: Map<Card, TrailState> = new Map();
  view: ViewController | null = null;
  // winAnimationCards: Card[] = [];

  constructor(view: ViewController) {
    this.view = view;

    Ticker.shared.add(this.update, this, UPDATE_PRIORITY.LOW);
  }

  get isAnimating() {
    if (this.activeAnimations.length === 0) {
      return false;
    }

    return this.activeAnimations.every(
      (animOrTimeline) =>
        !animOrTimeline.paused &&
        !animOrTimeline.completed &&
        !animOrTimeline.cancelled
    );
  }

  get isMobile() {
    return store.isMobile;
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

  animateToPosition(
    cards: Card[],
    to: Cell | Stack,
    params: AnimationParams = {}
  ) {
    if (!cards.length) {
      throw new Error('No cards provided');
    }

    if (this.disabled) {
      return Promise.resolve(false);
    }

    const scene = this.view.mainScene;

    // get first card position in mainScene space
    const start = scene.toLocal(cards[0].getGlobalPosition());

    // get the destination stack
    const toStack = to instanceof Stack ? to : to.stack;

    // get the target x position relative to toCell.stack
    const x = toStack.nextCardPosX;

    // get the target y position relative to toCell.stack
    const y = toStack.nextCardPosY;

    // get the target destination in mainScene space
    const dest = scene.toLocal({ x, y }, toStack);

    // Add cards to a temporary stack for moving
    const mover = new Stack('tmp');
    this.view.addChild(mover);
    mover.x = start.x;
    mover.y = start.y;
    mover.addChild(...cards);

    // reset local card positions
    mover.alignCards();

    // We have to animate via an object
    const animProxy = {
      x: mover.x,
      y: mover.y
    };

    const anim = animate(animProxy, {
      x: dest.x,
      y: dest.y,
      duration: getAnimationDurationForPoints(start, dest),
      ease: 'inOutSine',
      onUpdate: (anim) => {
        mover.x = animProxy.x;
        mover.y = animProxy.y;
      },
      onComplete: (anim) => {
        if (to instanceof FoundationCell) {
          mover.children[0].removeShadow();
          to.addCard(mover.children[0]);
        } else {
          toStack.addCards(...mover.children);
          toStack.alignCards();
        }

        this.view.removeChild(mover);
        mover.destroy();

        this.removeActiveAnimation(anim);
      },
      onPause: (anim) => {
        this.removeActiveAnimation(anim);
      },
      ...params
    });

    this.activeAnimations.push(anim);
    return anim;
  }

  cancelActiveAnimations() {
    this.activeAnimations.forEach((anim) => anim.cancel());
    this.activeAnimations = [];
    this.isWinAnimation = false;
  }

  completeHandAnimation() {
    const handAnimExisting = this.activeAnimations.find(
      (anim) => anim.id === 'handAnim'
    );

    if (
      handAnimExisting &&
      !handAnimExisting.cancelled &&
      !handAnimExisting.paused &&
      !handAnimExisting.completed
    ) {
      handAnimExisting.seek(handAnimExisting.duration);
      this.activeAnimations = this.activeAnimations.filter(
        (anim) => anim !== handAnimExisting
      );
    }
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

      this.activeAnimations.push(
        animate(card, {
          x: cell.x,
          y: cell.nextCardPosY,
          ease: 'easeInOutSine',
          duration: getAnimationDurationForPoints(
            new Point(card.x, card.y),
            new Point(cell.x, cell.nextCardPosY),
            1.75
          ),
          onComplete: (anim) => {
            // Remove the card from the main scene
            this.view.removeChild(card);
            cell.addCard(card); // moves the card to new container
            card.x = 0;
            card.y = 0;
            cell.alignCards();
            card.eventMode = 'static';

            this.removeActiveAnimation(anim);
            resolve(true);
          },
          onPause: (anim) => {
            this.removeActiveAnimation(anim);
            resolve(false);
          }
        })
      );
    });
  }

  deckCascade(deckCards: ContainerChild[]) {
    return new Promise((resolve, reject) => {
      const tl = createTimeline({
        duration: 1000,
        onComplete: (self) => {
          this.removeActiveAnimation(self);
          resolve(true);
        },
        onPause: (self) => {
          this.removeActiveAnimation(self);
          resolve(false);
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

      this.activeAnimations.push(tl);
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

      const x = store.layout.CARD_OFFSET_HORIZONTAL * (bankLength - 1);

      this.activeAnimations.push(
        animate(card, {
          x,
          y: 0,
          duration: CARD_ANIM_SPEED_MS,
          ease: 'easeOutSine',
          onChangeBegin: () => {
            deckSprites.removeChildAt(deckSprites.children.length - 1);
          },
          onComplete: (anim) => {
            this.removeActiveAnimation(anim);
            resolve(true);
          },
          onPause: (anim) => {
            this.removeActiveAnimation(anim);
            resolve(false);
          }
        })
      );
    });
  }

  fromHand(to: Cell | Stack, duration = 75) {
    if (!store.hand.count) {
      throw new Error('No cards in hand to animate');
    }

    this.completeHandAnimation();

    const scene = this.view.mainScene;

    // get hand position in mainScene space
    const start = scene.toLocal(store.hand.children[0].getGlobalPosition());

    // get the destination stack
    const toStack = to instanceof Stack ? to : to.stack;

    // get the target x position relative to toCell.stack
    const x = toStack.nextCardPosX;

    // get the target y position relative to toCell.stack
    const y = toStack.nextCardPosY;

    // get the target destination in mainScene space
    const dest = scene.toLocal({ x, y }, toStack);

    // Add cards to a temporary stack for moving
    const mover = new Stack('tmp');
    this.view.addChild(mover);
    mover.x = start.x;
    mover.y = start.y;
    mover.scale = store.hand.scale;
    mover.addChild(...store.hand.children);

    // reset local card positions
    mover.alignCards();

    // We have to animate via an object
    const animProxy = {
      x: mover.x,
      y: mover.y,
      scale: 1.15
    };

    // animate to position
    const handAnim = animate(animProxy, {
      x: dest.x,
      y: dest.y,
      scale: 1,
      duration,
      ease: 'inOutQuad',
      onUpdate: (anim) => {
        mover.x = animProxy.x;
        mover.y = animProxy.y;
        mover.scale = animProxy.scale;
      },
      onComplete: (anim) => {
        toStack.addCards(...mover.children);
        toStack.alignCards();
        store.hand.scale = 1;
        this.view.removeChild(mover);
        mover.destroy();
        this.removeActiveAnimation(anim);
      },
      onPause: (anim) => {
        this.removeActiveAnimation(anim);
      }
    });

    handAnim.id = 'handAnim';
    this.activeAnimations.push(handAnim);
    return handAnim;
  }

  private removeActiveAnimation(anim: JSAnimation | Timeline) {
    this.activeAnimations = this.activeAnimations.filter((_) => _ !== anim);
  }

  resetWinAnimation() {
    this.isWinAnimation = false;
    this.view.winAnimationCardLayer.removeChildren();
    this.view.winAnimationBackgroundLayer.removeChildren();
    this.trailStateByCard = new Map();
  }

  toHand() {
    return new Promise((resolve, _) => {
      this.completeHandAnimation();

      const scaleObj = { scale: 1 };

      const handAnim = animate(scaleObj, {
        scale: 1.15,
        ease: 'outBack(4)',
        duration: 200,
        onUpdate: (anim) => {
          store.hand.scale = scaleObj.scale;
        },
        onComplete: (anim) => {
          this.removeActiveAnimation(anim);
          resolve(true);
        },
        onPause: (anim) => {
          this.removeActiveAnimation(anim);
          resolve(false);
        }
      });

      handAnim.id = 'handAnim';
      this.activeAnimations.push(handAnim);
    });
  }

  undoDeckDraw(cards: Card[], onComplete: Function) {
    return new Promise((resolve, _) => {
      this.activeAnimations.push(
        animate(cards, {
          x: `-=${store.layout.CARD_W}`,
          y: `-=${store.layout.CARD_H / 6}`,
          alpha: {
            to: 0,
            ease: 'inQuint'
          },
          duration: 150,
          delay: stagger(75),
          ease: 'inQuad',
          onComplete: (anim) => {
            onComplete();
            this.removeActiveAnimation(anim);
            resolve(true);
          },
          onPause: (anim) => {
            this.removeActiveAnimation(anim);
            resolve(false);
          }
        })
      );
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
    // Set this so that the animation can be canceled from the outside.
    this.isWinAnimation = true;

    while (
      !isFoundationEmpty(foundation) &&
      count < 52 &&
      this.isWinAnimation
    ) {
      if (!this.isWinAnimation) {
        return;
      }

      const cell = foundation.at(count % 4);

      if (cell.topCard) {
        const card = cell.popCard();
        card.x = cell.x;
        card.y = cell.y;

        card.addShadow();
        // card.addGlow();

        if (store.isMobile) {
          card.velocityX = rand(0.5, 2) * -1;
          card.velocityY = rand(1.5, 3);
          card.gravity = rand(0.05, 0.15);
        } else {
          card.velocityX = rand(1.5, 4);
          card.velocityY = rand(1.5, 3) * 1 + (count % 4) * 1.1;
          card.gravity = rand(0.05, 0.15);
        }

        this.view.winAnimationCardLayer.addChild(card);

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

    this.isWinAnimation = false;
  }
}
