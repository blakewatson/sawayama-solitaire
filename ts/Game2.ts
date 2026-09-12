import { animate, createTimeline, stagger } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import {
  Application,
  Container,
  EventBoundary,
  Graphics,
  Point,
  Rectangle,
  Sprite,
  Ticker
} from 'pixi.js';
import PubSub from 'pubsub-js';
import { app } from './app';
import {
  BANK_BG,
  BANK_LABEL,
  BANK_STACK_ID,
  BOARD_CELL_LABEL,
  CARD_ANIM_SPEED_MS,
  DECK_CELL_ID,
  DECK_CELL_LABEL,
  GameEvent,
  HAND_STACK_ID,
  HAND_STACK_LABEL,
  Rank,
  Suit
} from './constants';
import AceTray from './entities/AceTray';
import Card, { CardClickData } from './entities/Card';
import Cell from './entities/Cell';
import Stack from './entities/Stack';
import {
  BankMove,
  CellMove,
  DeckDraw,
  GameMove,
  MoveType,
  store
} from './store';
import {
  getCellFromCard,
  isCardOnBoard,
  isFirstCardAllowedOnSecond,
  shuffleCards,
  signalPop,
  signalPush
} from './utils';

export default class Game {
  app: Application | null = null;
  bank: Container<Card> | null = null;
  bankBg: Container<Graphics> | null = null;
  board: Cell[] = [];
  deck: Card[] = [];
  deckCell: Cell | null = null;
  deckSprites: Container | null = null;
  foundation: AceTray[] = [];
  foundationBg: Graphics | null = null;
  hand: Stack | null = null;
  handOffset: [number, number] = [0, 0];
  handOrigin = 0;
  isAnimating = false;
  scene: Container | null = null;

  constructor(app: Application) {
    this.app = app;

    document.querySelector('.loader').remove();

    document
      .querySelector('#board')
      ?.append(this.app.canvas as HTMLCanvasElement);

    // set up the main container
    this.initMainScene();
    // set up the foundation (aces)
    this.initFoundation();
    // create the deck array in the store
    this.resetDeck();
    // create deck stack on the canvas
    this.displayDeck();
    // create the seven stacks
    this.createBoard();
    // create the card bank
    this.initBank();
    // init the hand stack
    this.hand = new Stack(HAND_STACK_ID, HAND_STACK_LABEL);
    this.hand.eventMode = 'none';
    this.addChild(this.hand);

    // start ticker
    Ticker.shared.add(this.update, this);

    this.dealCards().then(() => {
      this.listenForCardClick();
      this.listenForDeckClick();
      this.initDomUi();
    });

    // this.deck = [];
    // this.resetDeckSprites();

    // const cardA = new Card(Rank.Three, Suit.Diamonds);
    // this.board.at(0).addCard(cardA);

    // const cardB = new Card(Rank.Two, Suit.Clubs);
    // this.board.at(1).addCard(cardB);

    // this.listenForCardClick();
    // this.listenForDeckClick();
    // this.initDomUi();
  }

  addChild(...children: Container[]) {
    this.scene.addChild(...children);
  }

  animateFromBankToCell(toCell: Cell) {
    return new Promise((resolve, _) => {
      // get target position
      const targetPos = toCell.getGlobalPosition();
      // get source position
      const sourcePos = this.bank.getGlobalPosition();

      // Add cards to a temporary stack for moving
      const mover = new Stack(99);
      this.scene.addChild(mover);
      mover.x = sourcePos.x;
      mover.y = sourcePos.y;
      mover.addChild(this.bank.children.at(-1));

      const card = mover.children[0] as Card;

      const animProxy = {
        x: mover.x,
        y: mover.y
      };

      this.isAnimating = true;

      // animate to position
      animate(animProxy, {
        x: targetPos.x - card.x,
        y: targetPos.y - card.y,
        duration: 200,
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
          resolve(true);
        }
      });
    });
  }

  animateFromCellToBank(fromCell: Cell) {
    return new Promise((resolve, _) => {
      // get target position
      const targetPos = this.bank.getGlobalPosition();
      // offset by number of cards in the bank
      targetPos.x +=
        store.layout.CARD_OFFSET_HORIZONTAL * this.bank.children.length;

      // get source position
      const sourcePos = fromCell.getGlobalPosition();

      // Add cards to a temporary stack for moving
      const mover = new Stack(99);
      this.scene.addChild(mover);
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
      animate(animProxy, {
        x: targetPos.x - card.x,
        y: targetPos.y - card.y,
        duration: 200,
        ease: 'inOutSine',
        onUpdate: (anim) => {
          mover.x = animProxy.x;
          mover.y = animProxy.y;
        },
        onComplete: () => {
          this.bank.addChild(card);
          card.y = 0;
          card.x =
            store.layout.CARD_OFFSET_HORIZONTAL *
            (this.bank.children.length - 1);
          this.isAnimating = false;
          resolve(true);
        }
      });
    });
  }

  animateFromCellToCell(fromCell: Cell, toCell: Cell, cards: Card[]) {
    return new Promise((resolve, reject) => {
      // get target position
      const targetPos = toCell.getGlobalPosition();
      // get source position
      const sourcePos = fromCell.getGlobalPosition();

      // Add cards to a temporary stack for moving
      const mover = new Stack(99);
      this.scene.addChild(mover);
      mover.x = sourcePos.x;
      mover.y = sourcePos.y;
      mover.addChild(...cards);

      const card = mover.children[0] as Card;

      const animProxy = {
        x: mover.x,
        y: mover.y
      };

      this.isAnimating = true;

      // animate to position
      animate(animProxy, {
        x: targetPos.x - card.x,
        y:
          targetPos.y -
          card.y +
          store.layout.CARD_OFFSET_VERTICAL * toCell.count,
        duration: 200,
        ease: 'inOutSine',
        onUpdate: (anim) => {
          mover.x = animProxy.x;
          mover.y = animProxy.y;
        },
        onComplete: () => {
          toCell.addCards(...mover.children);
          toCell.alignCards();
          this.isAnimating = false;
          resolve(true);
        }
      });
    });
  }

  animateFromHandToBank() {
    return new Promise((resolve, reject) => {
      // get target position
      const targetPos = this.bank.getGlobalPosition();
      // get hand position
      const handPos = this.hand.getGlobalPosition();

      console.log('hand children', this.hand.children);

      // Add cards to a temporary stack for moving
      const mover = new Stack(99);
      this.scene.addChild(mover);
      mover.x = handPos.x;
      mover.y = handPos.y;
      mover.scale = this.hand.scale;
      mover.addChild(...this.hand.children);

      const card = mover.children[0] as Card;

      const animProxy = {
        x: mover.x,
        y: mover.y,
        scale: 1.15
      };

      this.isAnimating = true;

      // animate to position
      animate(animProxy, {
        x:
          targetPos.x -
          card.x +
          store.layout.CARD_OFFSET_HORIZONTAL * this.bank.children.length,
        y: targetPos.y - card.y,
        scale: 1,
        duration: 75,
        ease: 'inOutQuad',
        onUpdate: (anim) => {
          mover.x = animProxy.x;
          mover.y = animProxy.y;
          mover.scale = animProxy.scale;
        },
        onComplete: () => {
          this.bank.addChild(card);
          card.x =
            store.layout.CARD_OFFSET_HORIZONTAL *
            (this.bank.children.length - 1);
          card.y = 0;

          this.hand.scale = 1;
          this.scene.removeChild(mover);
          mover.destroy();
          this.isAnimating = false;
          resolve(true);
        }
      });
    });
  }

  animateFromHandToCell(targetCell: Cell) {
    return new Promise((resolve, reject) => {
      // get target position
      const targetPos = targetCell.getGlobalPosition();
      // get hand position
      const handPos = this.hand.getGlobalPosition();

      // Add cards to a temporary stack for moving
      const mover = new Stack(99);
      this.scene.addChild(mover);
      mover.x = handPos.x;
      mover.y = handPos.y;
      mover.scale = this.hand.scale;
      mover.addChild(...this.hand.children);

      const card = mover.children[0] as Card;

      const animProxy = {
        x: mover.x,
        y: mover.y,
        scale: 1.15
      };

      this.isAnimating = true;

      // animate to position
      animate(animProxy, {
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
          this.hand.scale = 1;
          this.scene.removeChild(mover);
          mover.destroy();
          this.isAnimating = false;
          resolve(true);
        }
      });
    });
  }

  animateToHand() {
    const scaleObj = { scale: 1 };

    this.isAnimating = true;

    animate(scaleObj, {
      scale: 1.15,
      ease: 'outBack(4)',
      duration: 200,
      onUpdate: (anim) => {
        this.hand.scale = scaleObj.scale;
      },
      onComplete: () => {
        this.isAnimating = false;
      }
    });
  }

  createBoard() {
    for (let i = 0; i < 7; i++) {
      let x = store.layout.DECK_POS.x;

      if (i > 0) {
        x =
          store.layout.DECK_POS.x +
          store.layout.CARD_W * i +
          store.layout.STACK_GAP * i;
      }

      const y = store.layout.BOARD_Y;

      const cell = new Cell(i, x, y, BOARD_CELL_LABEL);

      this.board.push(cell);
    }

    this.addChild(...this.board);
  }

  async dealCards() {
    let rowStartsAtCol = 0;
    let col = 0;

    for (let count = 0; count < 28; count++) {
      await this.dealNextCard(col);

      // go to the next cell
      col++;

      // if we’re past the last cell, start the next row one cell over
      if (col === 7) {
        rowStartsAtCol++;
        col = rowStartsAtCol;
      }
    }
  }

  dealNextCard(col = 0) {
    return new Promise((resolve, reject) => {
      // get the top card
      const card = this.deck.pop();
      card.x = store.layout.DECK_POS.x;
      card.y = store.layout.DECK_POS.y - this.deckSprites.children.length * 0.5;

      // make the deck visibly smaller
      this.deckSprites.children.pop();

      const cell = this.board[col];
      this.addChild(card);

      // col++;

      // if (col === 7) {
      //   start++;
      //   col = start;
      // }

      this.isAnimating = true;

      animate(card, {
        x: cell.x,
        y: cell.nextCardPosY,
        ease: 'easeInOutSine',
        duration: CARD_ANIM_SPEED_MS,
        onComplete: () => {
          // Remove the card from the main scene
          this.scene.removeChild(card);
          cell.addCard(card); // moves the card to new container
          card.x = 0;
          card.y = 0;
          cell.alignCards();
          // card.y = store.layout.CARD_OFFSET_VERTICAL * (cell.children.length - 1);
          card.eventMode = 'static';

          // if (start < 7) {
          //   return this.dealNextCard(start, col).then(() => resolve(true));
          // }

          this.isAnimating = false;
          resolve(true);
        }
      });
    });
  }

  displayDeck() {
    // add the free cell
    this.deckCell = new Cell(
      DECK_CELL_ID,
      store.layout.DECK_POS.x,
      store.layout.DECK_POS.y,
      DECK_CELL_LABEL,
      store.layout.CARD_W,
      store.layout.CARD_H
    );
    this.addChild(this.deckCell);

    // create the deck sprites
    this.deckSprites = new Container();
    this.deckSprites.x = store.layout.DECK_POS.x;
    this.deckSprites.y = store.layout.DECK_POS.y;

    this.resetDeckSprites();

    this.addChild(this.deckSprites);
  }

  doCardMove(move: CellMove | BankMove) {
    return this.animateFromHandToCell(move.to);
  }

  async drawFromDeck() {
    if (this.isAnimating) {
      return;
    }

    this.isAnimating = true;

    for (let i = 0; i < 3; i++) {
      if (!this.deck.length) {
        continue;
      }
      const card = this.deck.pop();
      this.bank.addChild(card);
      card.x = -store.layout.STACK_GAP - store.layout.CARD_W;
      card.y = -this.deckSprites.children.length * 0.5;
      await animateCard.bind(this)(card);
      card.eventMode = 'static';
    }

    this.isAnimating = false;

    this.refreshBank();

    // if the deck is out of cards, activate the free cell
    if (!this.deck.length) {
      this.deckCell.eventMode = 'static';
    }

    function animateCard(card: Card) {
      return new Promise((resolve, reject) => {
        animate(card, {
          x:
            store.layout.CARD_OFFSET_HORIZONTAL *
            (this.bank.children.length - 1),
          y: 0,
          duration: CARD_ANIM_SPEED_MS,
          ease: 'easeOutSine',
          onChangeBegin: () => {
            this.deckSprites.removeChildAt(
              this.deckSprites.children.length - 1
            );
          },
          onComplete: () => {
            resolve(true);
          }
        });
      });
    }
  }

  handleBoardClick(card: Card) {
    if (this.hand.count) {
      return;
    }

    if (this.bank.children.at(-1)?.id === card.id) {
      this.hand.reparentChild(card);
      this.handOrigin = BANK_STACK_ID;
      this.animateToHand();
      return;
    }

    const cell = getCellFromCard(card);

    if (!cell) {
      return;
    }

    // if empty, do nothing
    if (!cell.count) {
      return;
    }

    // If the selected stack is sequential, then add it to the hand.
    if (cell.isSequentialFrom(card)) {
      this.hand.reparentChild(...cell.sliceFromCard(card));
      this.handOrigin = cell.id;
      this.animateToHand();
    }
  }

  async handleHandClick() {
    if (!this.hand.count) {
      return;
    }

    const card = this.hand.children[0];

    // This checks what, if anything, the top center-ish area of the topmost
    // card in the hand is intersecting.
    const boundary = new EventBoundary(this.scene);
    const point = card.getGlobalPosition();
    const obj: Card | Cell | Container = boundary.hitTest(
      point.x + store.layout.CARD_W / 2,
      point.y + store.layout.CARD_H / 4
    );

    // If the target is the bank and the bank is the origin of this hand, allow
    // putting it back.
    if (
      (obj.label === BANK_LABEL ||
        obj.label === BANK_BG ||
        obj.parent.label === BANK_LABEL) &&
      this.handOrigin === BANK_STACK_ID &&
      this.hand.count === 1
    ) {
      await this.animateFromHandToBank();
      return;
    }

    // Otherwise, the bank is not a valid target for the hand.
    if (obj.label === BANK_LABEL || obj.label === BANK_BG) {
      return;
    }

    // See what cell is being targeted.
    let targetCell: Cell | null = null;
    let targetCellId = -1;

    if (obj instanceof Card) {
      targetCell = getCellFromCard(obj) ?? null;
      targetCellId = targetCell?.id ?? -1;
    }

    if (obj instanceof Cell) {
      targetCell = obj;
      targetCellId = targetCell.id;
    }

    // If the target is where the hand originally came from, allow the user to
    // put it back.
    if (targetCellId === this.handOrigin) {
      await this.animateFromHandToCell(targetCell);
      return;
    }

    // If the target is the free cell, but the hand has multiple cards, disallow
    // hand placement.
    if (targetCellId === DECK_CELL_ID && this.hand.count > 1) {
      return;
    }

    // If the target is an empty cell, place the hand.
    if (targetCell && targetCell.count === 0) {
      const fromCell =
        this.handOrigin === BANK_STACK_ID
          ? undefined
          : this.handOrigin === DECK_CELL_ID
          ? this.deckCell
          : this.board.find((cell) => cell.id === this.handOrigin);

      await this.moveAdd({
        type:
          this.handOrigin === BANK_STACK_ID
            ? MoveType.BANK_MOVE
            : MoveType.CELL_MOVE,
        cards: [...this.hand.children],
        from: fromCell,
        to: targetCell
      });
      return;
    }

    // If the target is a non-empty cell and the top card in the hand can be
    // placed on it, then move the hand to that cell.
    if (
      obj instanceof Card &&
      isCardOnBoard(obj) &&
      isFirstCardAllowedOnSecond(card, obj)
    ) {
      const fromCell =
        this.handOrigin === BANK_STACK_ID
          ? undefined
          : this.board.find((cell) => cell.id === this.handOrigin);

      await this.moveAdd({
        type:
          this.handOrigin === BANK_STACK_ID
            ? MoveType.BANK_MOVE
            : MoveType.CELL_MOVE,
        cards: [...this.hand.children],
        from: fromCell,
        to: targetCell
      });
      return;
    }
  }

  initBank() {
    this.bank = new Container({ label: BANK_LABEL });
    this.bank.x =
      store.layout.DECK_POS.x + store.layout.CARD_W + store.layout.STACK_GAP;
    this.bank.y = store.layout.DECK_POS.y;

    this.bankBg = new Container();
    this.bankBg.label = BANK_BG;
    this.bankBg.x = this.bank.x;
    this.bankBg.y = this.bank.y;

    const bankBgGraphic = new Graphics();
    const bankW = store.layout.VIEW_W - this.bank.x - store.layout.STACK_GAP;
    const bankH = store.layout.CARD_H;

    bankBgGraphic
      .rect(0, 0, bankW, bankH)
      .fill('#00000011')
      .rect(0, 0, bankW, 2)
      .fill('#00000033')
      .rect(0, 2, 2, bankH)
      .fill('#00000033')
      .rect(bankW - 2, 2, 2, bankH - 4)
      .fill('#ffffff10')
      .rect(0, bankH - 2, bankW, 2)
      .fill('#ffffff10');
    this.bankBg.addChild(bankBgGraphic);

    this.bank.eventMode = 'static';
    this.bankBg.eventMode = 'static';
    this.addChild(this.bankBg);
    this.addChild(this.bank);

    PubSub.subscribe(GameEvent.RESIZE, () => {
      this.bank.x =
        store.layout.DECK_POS.x + store.layout.CARD_W + store.layout.STACK_GAP;

      this.bank.y = store.layout.DECK_POS.y;

      this.bankBg[0].width =
        store.layout.VIEW_W - this.bank.x - store.layout.STACK_GAP;

      this.bankBg[0].height = store.layout.CARD_H;
    });
  }

  initDomUi() {
    // show the row of buttons
    document.querySelector('.buttons').removeAttribute('hidden');

    const undoButton = document.querySelector(
      '[data-undo]'
    ) as HTMLButtonElement;
    const redoButton = document.querySelector(
      '[data-redo]'
    ) as HTMLButtonElement;
    const resetButtons = Array.from(
      document.querySelectorAll('.game-over button, .reset-button')
    ) as HTMLButtonElement[];

    // undo
    undoButton.addEventListener('click', () => {
      if (this.isAnimating) {
        return;
      }

      this.moveUndo();
    });

    // redo
    redoButton.addEventListener('click', () => {
      if (this.isAnimating) {
        return;
      }

      this.moveRedo();
    });

    // reset
    resetButtons.forEach((el) => {
      el.addEventListener('click', () => {
        // this.reset();
      });
    });

    // Disable the undo and redo buttons as needed when the moves and movesCache
    // arrays change.
    store.moves.subscribe((moves) => {
      undoButton.disabled = moves.length === 0;
    });
    store.movesCache.subscribe((movesCache) => {
      redoButton.disabled = movesCache.length === 0;
    });
  }

  initFoundation() {
    // create the dark background
    const bg = new Graphics();
    bg.rect(0, 0, store.layout.ACE_TRAY_W, store.layout.ACE_TRAY_H);
    bg.fill('#00000033');
    this.foundationBg = bg;
    this.addChild(this.foundationBg);

    const positionTray = (tray: AceTray, idx) => {
      tray.x = store.layout.STACK_GAP;
      tray.y =
        store.layout.STACK_GAP +
        idx * (store.layout.CARD_H + store.layout.STACK_GAP);
    };

    Object.values(Suit).forEach((suit, idx) => {
      const tray = new AceTray(suit);
      this.foundation.push(tray);
    });

    this.foundation.forEach(positionTray);
    this.addChild(...this.foundation);

    PubSub.subscribe(GameEvent.RESIZE, () => {
      this.foundationBg.width = store.layout.ACE_TRAY_W;
      this.foundationBg.height = store.layout.ACE_TRAY_H;
      this.foundation.forEach(positionTray);
    });
  }

  initMainScene() {
    const { VIEW_W, VIEW_H } = store.layout;
    this.scene = new Container();
    this.scene.width = this.app.canvas.width;
    this.scene.height = this.app.canvas.height;
    this.scene.hitArea = new Rectangle(0, 0, VIEW_W, VIEW_H);

    this.scene.eventMode = 'static';
    this.scene.interactiveChildren = true;

    this.scene.addEventListener('pointermove', (event) => {
      store.mousePosition = [
        Math.round(event.globalX),
        Math.round(event.globalY)
      ];
    });

    // Using the DOM style method on purpose so we can attach this handler to
    // the capture phase. This is needed because main scene clicks need the
    // option to stop propagation.
    this.scene.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.hand.count) {
          return;
        }

        event.stopImmediatePropagation();

        this.handleHandClick();
      },
      { capture: true }
    );

    if (!this.app) {
      return;
    }

    this.app.stage.addChild(this.scene);

    PubSub.subscribe(GameEvent.RESIZE, () => {
      this.scene.width = store.layout.VIEW_W;
      this.scene.height = store.layout.VIEW_H;
      this.scene.hitArea = new Rectangle(
        0,
        0,
        store.layout.VIEW_W,
        store.layout.VIEW_H
      );
    });
  }

  listenForCardClick() {
    PubSub.subscribe(
      GameEvent.CARD_CLICK,
      (msg: string, data: CardClickData) => {
        if (this.hand.count) {
          return;
        }

        // if (data.card.parent === this.bank) {
        //   return;
        // }

        // I might end up getting rid of this if statement and letting this
        // method handle all card clicks.
        if (true) {
          this.handleBoardClick(data.card);
        }
      }
    );
  }

  listenForDeckClick() {
    this.deckSprites.eventMode = 'static';
    this.deckSprites.addEventListener('pointertap', async (event) => {
      if (this.isAnimating || this.hand.count || this.deck.length < 3) {
        return;
      }

      const cards = this.deck.slice(-3);

      this.moveAdd({
        type: MoveType.DECK_DRAW,
        cards
      });
    });
  }

  async moveAdd(move: GameMove, resetCache = true) {
    if (resetCache) {
      store.movesCache.value = [];
    }

    if (move.type === MoveType.BANK_MOVE) {
      signalPush(store.moves, move);
      await this.doCardMove(move);
      this.refreshBank();
      return;
    }

    if (move.type === MoveType.CELL_MOVE) {
      signalPush(store.moves, move);
      await this.doCardMove(move);
      return;
    }

    if (move.type === MoveType.DECK_DRAW) {
      signalPush(store.moves, move);
      await this.drawFromDeck();
      return;
    }
  }

  async moveRedo() {
    if (!store.movesCache.value.length || this.isAnimating) {
      return;
    }

    const move = signalPop(store.movesCache);

    if (move.type === MoveType.BANK_MOVE) {
      await this.redoBankMove(move);
      signalPush(store.moves, move);
      return;
    }

    if (move.type === MoveType.CELL_MOVE) {
      await this.redoCellMove(move);
      signalPush(store.moves, move);
      return;
    }

    if (move.type === MoveType.DECK_DRAW) {
      await this.redoDeckDraw();
      signalPush(store.moves, move);
      return;
    }

    // this.moveAdd(move, false);
  }

  async moveUndo() {
    if (!store.moves.value.length || this.isAnimating) {
      return;
    }

    const move = signalPop(store.moves);
    signalPush(store.movesCache, move);

    if (move.type === MoveType.BANK_MOVE) {
      await this.undoBankMove(move);
    }

    if (move.type === MoveType.CELL_MOVE) {
      await this.undoCellMove(move);
    }

    if (move.type === MoveType.DECK_DRAW) {
      await this.undoDeckDraw(move);
    }
  }

  async redoBankMove(move: BankMove) {
    return this.animateFromBankToCell(move.to);
  }

  async redoCellMove(move: CellMove) {
    return await this.animateFromCellToCell(move.from, move.to, move.cards);
  }

  async redoDeckDraw() {
    if (this.deck.length < 3) {
      return;
    }

    return await this.drawFromDeck();
  }

  refreshBank() {
    this.bank.children.forEach((card) => (card.eventMode = 'none'));

    if (this.bank.children.length) {
      this.bank.children.at(-1).eventMode = 'static';

      if (!this.hand) {
        // this.checkForFoundationCards();
      }
    }
  }

  resetDeck() {
    this.deck = [];

    Object.values(Rank).forEach((rank) => {
      Object.values(Suit).forEach((suit) => {
        this.deck.push(new Card(rank, suit));
      });
    });

    this.deck = shuffleCards(this.deck);
  }

  resetDeckSprites() {
    this.deckSprites.removeChildren();

    this.deck.forEach((card, i) => {
      const sprite = new Sprite(store.spritesheet.textures['back_red']);
      sprite.width = store.layout.CARD_W;
      sprite.height = store.layout.CARD_H;
      sprite.x = 0;
      sprite.y = 0;

      const spriteWrap = new Container();
      spriteWrap.x = 0;
      spriteWrap.y = i === 0 ? 0 : 0 - i + 0.5 * i;

      // The last card gets a drop shadow.
      if (i === this.deck.length - 1) {
        const shadow = new DropShadowFilter({
          alpha: 0.05,
          blur: 1,
          offset: new Point(0, 1),
          resolution: app.renderer.resolution
        });
        spriteWrap.filters = [shadow];
      }

      spriteWrap.addChild(sprite);

      this.deckSprites.addChild(spriteWrap);
    });
  }

  async undoBankMove(move: BankMove) {
    return this.animateFromCellToBank(move.to);
  }

  async undoCellMove(move: CellMove) {
    return this.animateFromCellToCell(move.to, move.from, move.cards);
  }

  undoDeckDraw(move: DeckDraw) {
    return new Promise((resolve, reject) => {
      const start = this.bank.children.length - 3;

      requestAnimationFrame(() => {
        const cards = [...move.cards];

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
          onComplete: () => {
            this.deck.push(...move.cards);
            this.bank.removeChild(...move.cards);
            this.resetDeckSprites();
            cards.forEach((card) => {
              card.x = 0;
              card.alpha = 1;
            });
          }
        });

        const deckCards = this.deckSprites.children;

        const tl = createTimeline({
          duration: 1000,
          onComplete: () => {
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
    });
  }

  update(ticker: Ticker) {
    if (this.hand) {
      this.hand.x = store.mousePosition[0];
      this.hand.y = store.mousePosition[1];
    }
  }
}
