import { animate, createTimeline, JSAnimation, stagger } from 'animejs';
import { Container, ContainerChild } from 'pixi.js';
import { CARD_ANIM_SPEED_MS, DECK_LABEL } from '../constants';
import Card from '../entities/Card';
import Cell from '../entities/Cell';
import FoundationCell from '../entities/FoundationCell';
import Stack from '../entities/Stack';
import { store } from '../store';
import ViewController from './ViewController';

export default class AnimationController {
  currentAnimation: JSAnimation | null = null;
  isAnimating = false;
  handIndicator: Container | null = null;
  view: ViewController | null = null;

  constructor(view: ViewController) {
    this.view = view;

    if (this.isMobile) {
      this.handIndicator = new Container();
    }
  }

  get isMobile() {
    return this.view.isMobile;
  }

  bankToCell(bank: Container<Card>, toCell: Cell, duration = 200) {
    return new Promise((resolve, _) => {
      // get target position
      const targetPos = toCell.getGlobalPosition();
      // get source position
      const sourcePos = bank.getGlobalPosition();

      // Add cards to a temporary stack for moving
      const mover = new Stack('tmp');
      this.view.addChild(mover);
      mover.x = sourcePos.x;
      mover.y = sourcePos.y;
      mover.addChild(bank.children.at(-1));

      const card = mover.children[0] as Card;

      const animProxy = {
        x: mover.x,
        y: mover.y
      };

      this.isAnimating = true;

      // animate to position
      this.currentAnimation = animate(animProxy, {
        x: targetPos.x - card.x,
        y:
          targetPos.y -
          card.y +
          (store.layout.CARD_OFFSET_VERTICAL * toCell.count - 1),
        duration,
        ease: 'inOutSine',
        onUpdate: (anim) => {
          mover.x = animProxy.x;
          mover.y = animProxy.y;
        },
        onComplete: () => {
          toCell.addCard(card);
          card.x = 0;
          toCell.alignCards();
          this.isAnimating = false;
          this.currentAnimation = null;
          resolve(true);
        }
      });
    });
  }

  cellToBank(bank: Container<Card>, fromCell: Cell, duration = 200) {
    return new Promise((resolve, _) => {
      // get target position
      const targetPos = bank.getGlobalPosition();
      // offset by number of cards in the bank
      targetPos.x += store.layout.CARD_OFFSET_HORIZONTAL * bank.children.length;

      // get source position
      const sourcePos = fromCell.getGlobalPosition();

      // Add cards to a temporary stack for moving
      const mover = new Stack('tmp');
      this.view.addChild(mover);
      mover.x = sourcePos.x;
      mover.y = sourcePos.y;
      mover.addChild(fromCell.popCard());

      const card = mover.children[0] as Card;

      const animProxy = {
        x: mover.x,
        y: mover.y
      };

      this.isAnimating = true;

      // animate to position
      this.currentAnimation = animate(animProxy, {
        x: targetPos.x - card.x,
        y: targetPos.y - card.y,
        duration,
        ease: 'inOutSine',
        onUpdate: (anim) => {
          mover.x = animProxy.x;
          mover.y = animProxy.y;
        },
        onComplete: () => {
          bank.addChild(card);
          card.y = 0;
          card.x =
            store.layout.CARD_OFFSET_HORIZONTAL * (bank.children.length - 1);
          this.isAnimating = false;
          this.currentAnimation = null;
          resolve(true);
        }
      });
    });
  }

  cellToCell(fromCell: Cell, toCell: Cell, cards: Card[], duration = 200) {
    return new Promise((resolve, reject) => {
      // get target position
      const targetPos = toCell.getGlobalPosition();
      // get source position
      const sourcePos = fromCell.getGlobalPosition();

      // Add cards to a temporary stack for moving
      const mover = new Stack('tmp');
      this.view.addChild(mover);
      mover.x = sourcePos.x;
      mover.y = sourcePos.y;
      mover.addChild(...cards);

      const card = mover.children[0] as Card;

      const animProxy = {
        x: mover.x,
        y: mover.y
      };

      this.isAnimating = true;

      const y =
        toCell instanceof FoundationCell
          ? targetPos.y - card.y
          : targetPos.y -
            card.y +
            store.layout.CARD_OFFSET_VERTICAL * toCell.count;

      // animate to position
      this.currentAnimation = animate(animProxy, {
        x: targetPos.x - card.x,
        y,
        duration,
        ease: 'inOutSine',
        onUpdate: (anim) => {
          mover.x = animProxy.x;
          mover.y = animProxy.y;
        },
        onComplete: () => {
          if (toCell instanceof FoundationCell) {
            toCell.add(mover.children[0]);
          } else {
            toCell.addCards(...mover.children);
            toCell.alignCards();
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

      // get the top card
      card.x = store.layout.DECK_POS.x;
      card.y = store.layout.DECK_POS.y - deckSprites.children.length * 0.5;

      // make the deck visibly smaller. TODO: Is this an acceptable side effect?
      deckSprites.children.pop();

      this.view.addChild(card);

      this.isAnimating = true;

      animate(card, {
        x: cell.x,
        y: cell.nextCardPosY,
        ease: 'easeInOutSine',
        duration: CARD_ANIM_SPEED_MS,
        onComplete: () => {
          // Remove the card from the main scene
          this.view.removeChild(card);
          cell.addCard(card); // moves the card to new container
          card.x = 0;
          card.y = 0;
          cell.alignCards();
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

      animate(card, {
        x: store.layout.CARD_OFFSET_HORIZONTAL * (bankLength - 1),
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

  handToBank(bank: Container<Card>, duration = 75) {
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
          store.layout.CARD_OFFSET_HORIZONTAL * bank.children.length,
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
          bank.addChild(card);
          card.x =
            store.layout.CARD_OFFSET_HORIZONTAL * (bank.children.length - 1);
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
          targetCell.alignCards();
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
    // if (this.isMobile) {
    //   return;
    // }

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
      }
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
}
