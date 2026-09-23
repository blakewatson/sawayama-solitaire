import { Application, Container, Graphics, Ticker } from 'pixi.js';
import {
  BANK_LABEL,
  BOARD_CELL_LABEL,
  DECK_CELL_LABEL,
  DECK_LABEL,
  FOUNDATION_LABEL,
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
  BankLocationRef,
  BankMove,
  CellMove,
  DeckDraw,
  GameMove,
  GameState,
  LocationRef,
  MoveType,
  NonBankLocationRef,
  store
} from './store';
import {
  getCellFromCard,
  getChildByLabel,
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
  cardsById: Map<string, Card> | null = null;
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

    // create the seven stacks
    this.createBoard();

    // create the card bank
    this.bank = this.view.initBank();

    // set up global card map
    this.buildCards();

    // set up the deck and deck cell
    this.deckCell = this.view.initDeckCell();
    this.deckSprites = this.view.initDeckSprites();

    // init the hand stack
    store.hand = new Hand();
    store.hand.eventMode = 'none';
    this.view.addChild(store.hand);

    // start ticker
    Ticker.shared.add(this.update, this);

    // start a new game or saved one
    this.initGameState().finally(() => {
      // Turn on the input controller.
      this.input = new InputController(this.view, {
        redo: this.tryRedo.bind(this),
        reset: this.tryReset.bind(this),
        tryRelease: this.tryRelease.bind(this),
        trySelect: this.trySelect.bind(this),
        undo: this.tryUndo.bind(this)
      });

      this.input.initDomUi();
    });

    // this.deck = [];
    // this.resetDeckSprites();

    // const cardA = new Card(Rank.Ace, Suit.Diamonds);
    // this.board.at(0).addCard(cardA);

    // const cardB = new Card(Rank.Two, Suit.Diamonds);
    // this.board.at(1).addCard(cardB);

    // this.checkForFoundationCards();

    // this.view.initDomUi();
  }

  buildCards() {
    this.cardsById = new Map();

    Object.values(Rank).forEach((rank) => {
      Object.values(Suit).forEach((suit) => {
        const card = new Card(rank, suit);
        this.cardsById.set(card.label, card);
      });
    });
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
        cardIds: [card.label],
        from: { kind: 'bank' },
        to: { kind: 'foundation', suit: card.suit }
      });
    }

    // is the deck cell card movable?
    if (shouldAutoMoveTopCard(this.deckCell, this.foundation)) {
      const card = this.deckCell.topCard;
      await this.moveAddAuto({
        type: MoveType.CELL_MOVE,
        cardIds: [card.label],
        from: { kind: 'deckCell' },
        to: { kind: 'foundation', suit: card.suit }
      });
    }

    // are any board cards movable?
    for (const cell of this.board) {
      if (shouldAutoMoveTopCard(cell, this.foundation)) {
        const card = cell.topCard;
        await this.moveAddAuto({
          type: MoveType.CELL_MOVE,
          cardIds: [card.label],
          from: this.getLocationRef(cell),
          to: { kind: 'foundation', suit: card.suit }
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

  doCardAutoMove(move: CellMove | BankMove) {
    if (move.type === MoveType.BANK_MOVE) {
      const target = this.getLocation(move.to);
      return this.animator.bankToCell(this.bank, target);
    }

    const fromLocation = this.getLocation(move.from);
    const toLocation = this.getLocation(move.to);
    const cards = this.getCards(move.cardIds);
    return this.animator.cellToCell(fromLocation, toLocation, cards);
  }

  doCardMove(move: CellMove | BankMove) {
    if (move.to.kind === 'foundation') {
      return this.animator.handToFoundationCell(this.getLocation(move.to));
    }

    return this.animator.handToCell(this.getLocation(move.to));
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
      await this.animator.drawCardFromDeck(card, this.bank.count);
      card.eventMode = 'static';
    }

    this.refreshBank();

    // if the deck is out of cards, activate the free cell
    if (!this.deck.length) {
      this.deckCell.eventMode = 'static';
    }
  }

  getCardById(id: string) {
    const card = this.cardsById.get(id);

    if (!card) {
      throw new Error(`Could not find card with ID ${id}.`);
    }

    return card;
  }

  getCards(ids: string[]): Card[] {
    return ids.map((id) => this.getCardById(id));
  }

  getLocation(ref: BankLocationRef): Stack;
  getLocation(ref: { kind: 'foundation'; suit: Suit }): FoundationCell;
  getLocation(ref: NonBankLocationRef): Cell;
  getLocation(ref: LocationRef): Cell | Stack {
    switch (ref.kind) {
      case 'board':
        return this.board[ref.index];

      case 'foundation':
        return this.foundation.find((cell) => cell.suit === ref.suit)!;

      case 'deckCell':
        return this.deckCell;

      case 'bank':
        return this.bank;
    }
  }

  getLocationRef(location: Stack): BankLocationRef;
  getLocationRef(location: Cell): NonBankLocationRef;
  getLocationRef(location: Cell | Stack): LocationRef {
    if (location.label.startsWith(BOARD_CELL_LABEL)) {
      return {
        kind: 'board',
        index: this.board.findIndex((b) => b.label === location.label)
      };
    }

    if (location.label === FOUNDATION_LABEL) {
      return { kind: 'foundation', suit: (location as FoundationCell).suit };
    }

    if (location.label === DECK_CELL_LABEL) {
      return { kind: 'deckCell' };
    }

    if (location.label === BANK_LABEL && location instanceof Stack) {
      return { kind: 'bank' };
    }
  }

  initBankState(bank: string[]) {
    bank.forEach((cardId) => {
      const card = this.getCardById(cardId);
      this.bank.addCards(card);
    });
    this.bank.alignCardsHorizontally();
    this.refreshBank();
  }

  initBoardState(board: string[][]) {
    board.forEach((cellCards, index) => {
      const cell = this.board[index];
      cellCards.forEach((cardId) => {
        const card = this.getCardById(cardId);
        cell.addCards(card);
      });
      cell.alignCardsVertically();
    });
  }

  initFoundation() {
    Object.values(Suit).forEach((suit) => {
      const tray = new FoundationCell(suit, 0, 0);
      this.foundation.push(tray);
    });

    this.view.positionFoundationTrays(this.foundation);
  }

  initFoundationState(foundation: Record<Suit, string[]>) {
    Object.entries(foundation).forEach(([suit, cards]) => {
      const tray = this.foundation.find((f) => f.suit === suit);
      cards.forEach((cardId) => {
        const card = this.getCardById(cardId);
        tray.addCards(card);
      });
    });
  }

  async initGameState() {
    const existingState = localStorage.getItem('gameState');

    if (!existingState) {
      // create the deck array
      this.resetDeck();
      // create the deck sprites
      this.resetDeckSprites();

      await this.dealCards();
      await this.checkForFoundationCards();
      return;
    }

    const state = JSON.parse(existingState) as GameState;

    const { bank, board, deck, deckCell, foundation, moves, movesCache } =
      state;

    if (bank.length) {
      this.initBankState(bank);
    }

    if (board.some((cell) => cell.length)) {
      this.initBoardState(board);
    }

    if (deck.length) {
      this.deck = deck.map((cardId) => this.getCardById(cardId));
      this.resetDeckSprites();
    } else if (deckCell) {
      const card = this.getCardById(deckCell);
      this.deckCell.addCards(card);
    }

    if (Object.values(foundation).some((cards) => cards.length)) {
      this.initFoundationState(foundation);
    }

    if (moves.length) {
      store.moves.value = moves;
    }

    if (movesCache.length) {
      store.movesCache.value = movesCache;
    }
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
      this.saveGameState();
      return;
    }

    if (move.type === MoveType.CELL_MOVE) {
      signalPush(store.moves, move);
      await this.doCardMove(move);
      await this.checkForFoundationCards();
      this.saveGameState();
      return;
    }

    if (move.type === MoveType.DECK_DRAW) {
      signalPush(store.moves, move);
      await this.drawFromDeck();
      await this.checkForFoundationCards();
      this.saveGameState();
      return;
    }
  }

  async moveAddAuto(move: BankMove | CellMove) {
    if (move.type === MoveType.BANK_MOVE) {
      signalPush(store.moves, move);
      await this.doCardAutoMove(move);
      this.refreshBank();
      await this.checkForFoundationCards();
      this.saveGameState();
      return;
    }

    if (move.type === MoveType.CELL_MOVE) {
      signalPush(store.moves, move);
      await this.doCardAutoMove(move);
      await this.checkForFoundationCards();
      this.saveGameState();
      return;
    }
  }

  async moveHandToCell(targetCell: Cell) {
    if (this.handOrigin === BANK_LABEL) {
      return await this.moveAdd({
        type: MoveType.BANK_MOVE,
        cardIds: store.hand.children.map((c) => c.label),
        from: { kind: 'bank' },
        to: this.getLocationRef(targetCell)
      });
    }

    const fromCell =
      this.handOrigin === DECK_CELL_LABEL
        ? this.deckCell
        : this.board.find((cell) => cell.label === this.handOrigin);

    return await this.moveAdd({
      type: MoveType.CELL_MOVE,
      cardIds: store.hand.children.map((c) => c.label),
      from: this.getLocationRef(fromCell),
      to: this.getLocationRef(targetCell)
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
      this.saveGameState();
      return;
    }

    if (move.type === MoveType.CELL_MOVE) {
      await this.redoCellMove(move);
      signalPush(store.moves, move);
      this.saveGameState();
      return;
    }

    if (move.type === MoveType.DECK_DRAW) {
      await this.redoDeckDraw();
      signalPush(store.moves, move);
      this.saveGameState();
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

    this.saveGameState();
  }

  async redoBankMove(move: BankMove) {
    const target = this.getLocation(move.to);
    await this.animator.bankToCell(this.bank, target);
    this.refreshBank();
  }

  async redoCellMove(move: CellMove) {
    const fromLocation = this.getLocation(move.from);
    const toLocation = this.getLocation(move.to);
    const cards = this.getCards(move.cardIds);
    return await this.animator.cellToCell(fromLocation, toLocation, cards);
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

    this.cardsById.forEach((card) => {
      this.deck.push(card);
    });

    this.deck = shuffleCards(this.deck);
  }

  resetDeckSprites() {
    this.deckSprites.removeChildren();
    this.deckSprites.addChild(...this.view.getDeckSprites(this.deck.length));
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

  async tryRedo() {
    if (this.animator.isAnimating) {
      return;
    }

    return this.moveRedo();
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

  async tryReset() {
    this.resetDeck();
    this.resetDeckSprites();
    this.bank.removeChildren();
    this.deckCell.removeChildren();
    this.board.forEach((cell) => cell.stack.removeChildren());
    this.foundation.forEach((tray) => tray.stack.removeChildren());
    store.moves.value = [];
    store.movesCache.value = [];
    await this.dealCards();
    await this.checkForFoundationCards();
    this.saveGameState();
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
        cardIds: cards.map((_) => _.label)
      });
    }
  }

  async tryUndo() {
    if (this.animator.isAnimating) {
      return;
    }

    this.moveUndo();
  }

  saveGameState() {
    const clubs = this.foundation.find((c) => c.suit === Suit.Clubs);
    const diamonds = this.foundation.find((c) => c.suit === Suit.Diamonds);
    const hearts = this.foundation.find((c) => c.suit === Suit.Hearts);
    const spades = this.foundation.find((c) => c.suit === Suit.Spades);

    const game: GameState = {
      bank: this.bank.children.map((_) => _.label),
      board: this.board.map((cell) => {
        return cell.cards.map((card) => card.label);
      }),
      deck: this.deck.map((_) => _.label),
      deckCell: this.deckCell.topCard?.label || '',
      foundation: {
        clubs: clubs.cards.map((c) => c.label),
        diamonds: diamonds.cards.map((c) => c.label),
        hearts: hearts.cards.map((c) => c.label),
        spades: spades.cards.map((c) => c.label)
      },
      moves: store.moves.value,
      movesCache: store.movesCache.value
    };

    localStorage.setItem('gameState', JSON.stringify(game));
  }

  async undoBankMove(move: BankMove) {
    const target = this.getLocation(move.to);
    await this.animator.cellToBank(this.bank, target);
    this.refreshBank();
  }

  async undoCellMove(move: CellMove) {
    if (move.to.kind === 'foundation') {
      this.getCardById(move.cardIds[0]).eventMode = 'static';
    }
    const fromLocation = this.getLocation(move.from);
    const toLocation = this.getLocation(move.to);
    const cards = this.getCards(move.cardIds);
    return this.animator.cellToCell(toLocation, fromLocation, cards);
  }

  undoDeckDraw(move: DeckDraw) {
    return new Promise((resolve, reject) => {
      const start = this.bank.count - 3;

      requestAnimationFrame(async () => {
        const cards = this.getCards(move.cardIds);

        const undrawPromise = this.animator.undoDeckDraw(cards, () => {
          this.deck.push(...cards);
          this.bank.removeChild(...cards);
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
