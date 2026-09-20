import { DropShadowFilter } from 'pixi-filters';
import {
  Application,
  Container,
  Graphics,
  Point,
  Sprite,
  Ticker
} from 'pixi.js';
import { app } from './app';
import {
  BANK_BG,
  BANK_LABEL,
  BOARD_CELL_LABEL,
  DECK_CELL_LABEL,
  DECK_LABEL,
  Rank,
  Suit
} from './constants';
import AnimationController from './controllers/AnimationController';
import InputController, { InputState } from './controllers/InputController';
import ViewController from './controllers/ViewController';
import Card from './entities/Card';
import Cell from './entities/Cell';
import FoundationCell from './entities/FoundationCell';
import Hand from './entities/Hand';
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
  getChildByLabel,
  getFoundationCell,
  getTargetCell,
  isBankObj,
  isCardOnBoard,
  isFirstCardAllowedOnSecond,
  shouldAutoMoveTopCard,
  shuffleCards,
  signalPop,
  signalPush
} from './utils';

export default class Game {
  animator: AnimationController | null = null;
  app: Application | null = null;
  bank: Stack | null = null;
  bankBg: Container<Graphics> | null = null;
  board: Cell[] = [];
  deck: Card[] = [];
  deckCell: Cell | null = null;
  deckSprites: Container | null = null;
  foundation: FoundationCell[] = [];
  handOffset: [number, number] = [0, 0];
  handOrigin = '';
  input: InputController | null = null;
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
    store.hand = new Hand();
    store.hand.eventMode = 'none';
    this.view.addChild(store.hand);

    // start ticker
    Ticker.shared.add(this.update, this);

    // Turn on the input controller.
    this.input = new InputController(this.view, {
      tryRelease: this.tryRelease.bind(this),
      trySelect: this.trySelect.bind(this)
    });

    this.dealCards().then(async () => {
      await this.checkForFoundationCards();
      this.initDomUi();
    });

    // this.deck = [];
    // this.resetDeckSprites();

    // const cardA = new Card(Rank.Ace, Suit.Diamonds);
    // this.board.at(0).addCard(cardA);

    // const cardB = new Card(Rank.Two, Suit.Diamonds);
    // this.board.at(1).addCard(cardB);

    // this.checkForFoundationCards();

    // this.initDomUi();
  }

  /**
   * Looks for any cards that can be automatically moved to the foundation
   * (aces and twos) and moves them.
   */
  async checkForFoundationCards() {
    // is the top bank card movable?
    if (shouldAutoMoveTopCard(this.bank, this.foundation)) {
      const card = this.bank.topCard;
      this.moveAddAuto({
        type: MoveType.BANK_MOVE,
        to: getFoundationCell(card.suit, this.foundation)
      });
    }

    // is the deck cell card movable?
    if (shouldAutoMoveTopCard(this.deckCell, this.foundation)) {
      const card = this.deckCell.topCard;
      await this.moveAddAuto({
        type: MoveType.CELL_MOVE,
        cards: [card],
        from: this.deckCell,
        to: getFoundationCell(card.suit, this.foundation)
      });
    }

    // are any board cards movable?
    for (const cell of this.board) {
      if (shouldAutoMoveTopCard(cell, this.foundation)) {
        const card = cell.topCard;
        await this.moveAddAuto({
          type: MoveType.CELL_MOVE,
          cards: [card],
          from: cell,
          to: getFoundationCell(card.suit, this.foundation)
        });
        break;
      }
    }
  }

  createBoard() {
    for (let i = 0; i < 7; i++) {
      let x = store.layout.BOARD_POS.x;

      if (i > 0) {
        x =
          store.layout.BOARD_POS.x +
          store.layout.CARD_W * i +
          store.layout.STACK_GAP * i;
      }

      const y = store.layout.BOARD_POS.y;

      const cell = new Cell(x, y, `${BOARD_CELL_LABEL}_${i}`);

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
    const card = this.deck.pop();
    const cell = this.board[col];
    return this.animator.dealCard(card, cell);
  }

  displayDeck() {
    // add the free cell
    this.deckCell = new Cell(
      store.layout.DECK_POS.x,
      store.layout.DECK_POS.y,
      DECK_CELL_LABEL,
      true,
      store.layout.CARD_W,
      store.layout.CARD_H
    );
    this.view.addChild(this.deckCell);

    // create the deck sprites
    this.deckSprites = new Container();
    this.deckSprites.label = DECK_LABEL;
    this.deckSprites.x = store.layout.DECK_POS.x;
    this.deckSprites.y = store.layout.DECK_POS.y;
    this.deckSprites.eventMode = 'static';

    this.resetDeckSprites();

    this.view.addChild(this.deckSprites);
  }

  doCardAutoMove(move: CellMove | BankMove) {
    if (move.type === MoveType.BANK_MOVE) {
      return this.animator.bankToCell(this.bank, move.to);
    }

    return this.animator.cellToCell(move.from, move.to, move.cards);
  }

  doCardMove(move: CellMove | BankMove) {
    if (move.to instanceof FoundationCell) {
      return this.animator.handToFoundationCell(move.to);
    }

    return this.animator.handToCell(move.to);
  }

  async drawFromDeck() {
    if (this.animator.isAnimating) {
      return;
    }

    for (let i = 0; i < 3; i++) {
      if (!this.deck.length) {
        continue;
      }
      const card = this.deck.pop();
      this.bank.addChild(card);
      const deckPos = this.deckCell.getGlobalPosition();
      const deckLocal = this.bank.toLocal(deckPos);
      card.x = store.layout.DECK_POS.x - store.layout.BANK_POS.x;
      card.y = deckLocal.y - this.deckSprites.children.length * 0.5;
      // card.x = -store.layout.STACK_GAP - store.layout.CARD_W;
      // card.y = -this.deckSprites.children.length * 0.5;
      await this.animator.drawCardFromDeck(card, this.bank.count);
      card.eventMode = 'static';
    }

    this.refreshBank();

    // if the deck is out of cards, activate the free cell
    if (!this.deck.length) {
      this.deckCell.eventMode = 'static';
    }
  }

  initBank() {
    this.bank = new Stack(BANK_LABEL);
    this.bank.alignCardsAfterAdding = false;
    this.bank.x = store.layout.BANK_POS.x;
    this.bank.y = store.layout.BANK_POS.y;

    this.bankBg = new Container();
    this.bankBg.label = BANK_BG;
    this.bankBg.x = this.bank.x;
    this.bankBg.y = this.bank.y;

    const bankBgGraphic = new Graphics();
    const bankW = store.layout.BANK_W;
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
      if (this.animator.isAnimating) {
        return;
      }

      this.moveUndo();
    });

    // redo
    redoButton.addEventListener('click', () => {
      if (this.animator.isAnimating) {
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
    Object.values(Suit).forEach((suit, idx) => {
      const x = this.view.isMobile
        ? store.layout.VIEW_W -
          (store.layout.STACK_GAP + store.layout.CARD_W) * (idx + 1)
        : store.layout.STACK_GAP;

      const y = this.view.isMobile
        ? store.layout.DECK_POS.y
        : store.layout.STACK_GAP +
          idx * (store.layout.CARD_H + store.layout.STACK_GAP);

      const tray = new FoundationCell(suit, x, y);
      this.foundation.push(tray);
    });

    this.view.positionFoundationTrays(this.foundation);
  }

  getHandOriginObj() {
    if (this.handOrigin === BANK_LABEL) {
      return this.bank;
    }

    if (this.handOrigin === DECK_CELL_LABEL) {
      return this.deckCell;
    }

    return this.board.find((cell) => cell.label === this.handOrigin);
  }

  async moveAdd(move: GameMove, resetCache = true) {
    if (resetCache) {
      store.movesCache.value = [];
    }

    if (move.type === MoveType.BANK_MOVE) {
      signalPush(store.moves, move);
      await this.doCardMove(move);
      this.refreshBank();
      await this.checkForFoundationCards();
      return;
    }

    if (move.type === MoveType.CELL_MOVE) {
      signalPush(store.moves, move);
      await this.doCardMove(move);
      await this.checkForFoundationCards();
      return;
    }

    if (move.type === MoveType.DECK_DRAW) {
      signalPush(store.moves, move);
      await this.drawFromDeck();
      await this.checkForFoundationCards();
      return;
    }
  }

  async moveAddAuto(move: BankMove | CellMove) {
    if (move.type === MoveType.BANK_MOVE) {
      signalPush(store.moves, move);
      await this.doCardAutoMove(move);
      this.refreshBank();
      await this.checkForFoundationCards();
      return;
    }

    if (move.type === MoveType.CELL_MOVE) {
      signalPush(store.moves, move);
      await this.doCardAutoMove(move);
      await this.checkForFoundationCards();
      return;
    }
  }

  async moveHandToCell(targetCell: Cell) {
    const fromCell =
      this.handOrigin === BANK_LABEL
        ? undefined
        : this.handOrigin === DECK_CELL_LABEL
        ? this.deckCell
        : this.board.find((cell) => cell.label === this.handOrigin);

    await this.moveAdd({
      type:
        this.handOrigin === BANK_LABEL
          ? MoveType.BANK_MOVE
          : MoveType.CELL_MOVE,
      cards: [...store.hand.children],
      from: fromCell,
      to: targetCell
    });
  }

  async moveRedo() {
    if (!store.movesCache.value.length || this.animator.isAnimating) {
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
    if (!store.moves.value.length || this.animator.isAnimating) {
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
    await this.animator.bankToCell(this.bank, move.to);
    this.refreshBank();
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

    if (this.bank.count) {
      this.bank.topCard.eventMode = 'static';
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

  async returnHandToOrigin() {
    const originObj = this.getHandOriginObj();

    if (originObj.label === BANK_LABEL) {
      await this.animator.handToBank(this.bank);
      return true;
    }

    if (originObj instanceof Cell) {
      await this.animator.handToCell(originObj);
      return true;
    }
  }

  async returnHandToOriginIfDragging() {
    if (this.input.currentState === InputState.DRAGGING) {
      this.returnHandToOrigin();
    }
  }

  async selectCardsFromCard(card: Card) {
    if (store.hand.count) {
      return;
    }

    // if it’s from the bank, it’s gotta be the last card and not animating
    if (getChildByLabel(this.bank, card.label)) {
      if (this.animator.isAnimating) {
        return;
      }

      if (this.bank.topCard?.label !== card.label) {
        return;
      }

      store.hand.reparentChild(card);
      this.handOrigin = BANK_LABEL;
      await this.animator.toHand();
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
      this.handOrigin = cell.label;
      await this.animator.toHand();
    }
  }

  async tryRelease(obj: Card | Cell | Container) {
    if (!store.hand.count) {
      return;
    }

    const card = store.hand.children.at(0);

    // If the target is the bank and the bank is the origin of this hand, allow
    // putting it back.
    if (isBankObj(obj)) {
      if (this.handOrigin === BANK_LABEL && store.hand.count === 1) {
        return this.animator.handToBank(this.bank);
      }

      // Otherwise, the bank is not a valid target for the hand.
      this.returnHandToOriginIfDragging();
      return;
    }

    // See what cell is being targeted.
    const targetCell = getTargetCell(obj);

    if (!targetCell) {
      return this.returnHandToOriginIfDragging();
    }

    // If the hand is one card and it's allowed on the foundation, place it there.
    if (targetCell instanceof FoundationCell) {
      if (
        store.hand.count === 1 &&
        store.hand.children[0].label === targetCell.nextCardNeeded()
      ) {
        return this.moveHandToCell(targetCell);
      }

      // Otherwise, the placement was unsuccessful.
      return this.returnHandToOriginIfDragging();
    }

    // If the target is where the hand originally came from, allow the user to
    // put it back.
    if (targetCell.label === this.handOrigin) {
      return this.animator.handToCell(targetCell);
    }

    // If the target is the free cell, but the hand has multiple cards, disallow
    // hand placement.
    if (targetCell.label === DECK_CELL_LABEL && store.hand.count > 1) {
      return;
    }

    // If the target is an empty cell, place the hand.
    const isTargetCellEmpty = targetCell && targetCell.count === 0;

    // If the target is a non-empty cell and the top card in the hand can be
    // placed on it, then move the hand to that cell.
    const isValidBoardPlacement =
      obj instanceof Card &&
      isCardOnBoard(obj) &&
      isFirstCardAllowedOnSecond(card, obj);

    if (isTargetCellEmpty || isValidBoardPlacement) {
      return this.moveHandToCell(targetCell);
    }

    // If we are dragging, then put the card back since placement wasn't successful.
    return this.returnHandToOriginIfDragging();
  }

  async trySelect(obj: Card | Cell | Container) {
    if (obj instanceof Card) {
      this.selectCardsFromCard(obj);
    }

    if (obj.label === DECK_LABEL) {
      if (
        this.animator.isAnimating ||
        store.hand.count ||
        this.deck.length < 3
      ) {
        return;
      }

      const cards = this.deck.slice(-3);

      this.moveAdd({
        type: MoveType.DECK_DRAW,
        cards
      });
    }
  }

  async undoBankMove(move: BankMove) {
    await this.animator.cellToBank(this.bank, move.to);
    this.refreshBank();
  }

  async undoCellMove(move: CellMove) {
    if (move.to instanceof FoundationCell) {
      move.cards[0].eventMode = 'static';
    }
    return this.animator.cellToCell(move.to, move.from, move.cards);
  }

  undoDeckDraw(move: DeckDraw) {
    return new Promise((resolve, reject) => {
      const start = this.bank.count - 3;

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
    if (true) {
      store.hand.x = store.mousePosition[0];
      store.hand.y = store.mousePosition[1];
    }
  }
}
