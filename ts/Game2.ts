import { animate } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import {
  Application,
  Container,
  EventBoundary,
  Graphics,
  Point,
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
import AnimationController from './controllers/AnimationController';
import ViewController from './controllers/ViewController';
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
  animator: AnimationController | null = null;
  app: Application | null = null;
  bank: Container<Card> | null = null;
  bankBg: Container<Graphics> | null = null;
  board: Cell[] = [];
  deck: Card[] = [];
  deckCell: Cell | null = null;
  deckSprites: Container | null = null;
  foundation: AceTray[] = [];
  foundationBg: Graphics | null = null;
  handOffset: [number, number] = [0, 0];
  handOrigin = 0;
  isAnimating = false;
  view: ViewController | null = null;

  constructor(app: Application) {
    this.app = app;

    document.querySelector('.loader').remove();

    document
      .querySelector('#board')
      ?.append(this.app.canvas as HTMLCanvasElement);

    // set up the main container
    this.view = new ViewController(this.app);

    // set up the animator
    this.animator = new AnimationController(this.view);

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
    store.hand = new Stack(HAND_STACK_ID, HAND_STACK_LABEL);
    store.hand.eventMode = 'none';
    this.view.addChild(store.hand);

    // start ticker
    Ticker.shared.add(this.update, this);

    this.dealCards().then(() => {
      this.listenForCardClick();
      this.listenForDeckClick();
      this.listenForMainSceneClick();
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

    this.view.addChild(...this.board);
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
      this.view.addChild(card);

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
          this.view.removeChild(card);
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
    this.view.addChild(this.deckCell);

    // create the deck sprites
    this.deckSprites = new Container();
    this.deckSprites.x = store.layout.DECK_POS.x;
    this.deckSprites.y = store.layout.DECK_POS.y;

    this.resetDeckSprites();

    this.view.addChild(this.deckSprites);
  }

  doCardMove(move: CellMove | BankMove) {
    return this.animator.handToCell(move.to);
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
    if (store.hand.count) {
      return;
    }

    if (this.bank.children.at(-1)?.id === card.id) {
      store.hand.reparentChild(card);
      this.handOrigin = BANK_STACK_ID;
      this.animator.toHand();
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
      store.hand.reparentChild(...cell.sliceFromCard(card));
      this.handOrigin = cell.id;
      this.animator.toHand();
    }
  }

  async handleHandClick() {
    if (!store.hand.count) {
      return;
    }

    const card = store.hand.children[0];

    // This checks what, if anything, the top center-ish area of the topmost
    // card in the hand is intersecting.
    const boundary = new EventBoundary(this.view.mainScene);
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
      store.hand.count === 1
    ) {
      await this.animator.handToBank(this.bank);
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
      await this.animator.handToCell(targetCell);
      return;
    }

    // If the target is the free cell, but the hand has multiple cards, disallow
    // hand placement.
    if (targetCellId === DECK_CELL_ID && store.hand.count > 1) {
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
        cards: [...store.hand.children],
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
        cards: [...store.hand.children],
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
    this.view.addChild(this.bankBg);
    this.view.addChild(this.bank);

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
    this.view.addChild(this.foundationBg);

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
    this.view.addChild(...this.foundation);

    PubSub.subscribe(GameEvent.RESIZE, () => {
      this.foundationBg.width = store.layout.ACE_TRAY_W;
      this.foundationBg.height = store.layout.ACE_TRAY_H;
      this.foundation.forEach(positionTray);
    });
  }

  listenForCardClick() {
    PubSub.subscribe(
      GameEvent.CARD_CLICK,
      (msg: string, data: CardClickData) => {
        if (store.hand.count) {
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
      if (this.isAnimating || store.hand.count || this.deck.length < 3) {
        return;
      }

      const cards = this.deck.slice(-3);

      this.moveAdd({
        type: MoveType.DECK_DRAW,
        cards
      });
    });
  }

  listenForMainSceneClick() {
    PubSub.subscribe(GameEvent.MAIN_SCENE_CLICK, () => {
      this.handleHandClick();
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
    return this.animator.bankToCell(this.bank, move.to);
  }

  async redoCellMove(move: CellMove) {
    return await this.animator.cellToCell(move.from, move.to, move.cards);
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

      if (!store.hand) {
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
    return this.animator.cellToBank(this.bank, move.to);
  }

  async undoCellMove(move: CellMove) {
    return this.animator.cellToCell(move.to, move.from, move.cards);
  }

  undoDeckDraw(move: DeckDraw) {
    return new Promise((resolve, reject) => {
      const start = this.bank.children.length - 3;

      requestAnimationFrame(async () => {
        const cards = [...move.cards];

        const undrawPromise = this.animator.undoDeckDraw(cards, () => {
          this.deck.push(...move.cards);
          this.bank.removeChild(...move.cards);
          this.resetDeckSprites();
          cards.forEach((card) => {
            card.x = 0;
            card.alpha = 1;
          });
        });

        const deckCards = this.deckSprites.children;

        const cascadePromise = this.animator.deckCascade(deckCards);

        await Promise.all([undrawPromise, cascadePromise]);

        resolve(true);
      });
    });
  }

  update(ticker: Ticker) {
    if (store.hand) {
      store.hand.x = store.mousePosition[0];
      store.hand.y = store.mousePosition[1];
    }
  }
}
