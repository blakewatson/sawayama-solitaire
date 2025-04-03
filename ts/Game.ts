import anime from 'animejs';
import {
  Application,
  Color,
  Container,
  DisplayObject,
  EventBoundary,
  Graphics,
  Rectangle,
  Sprite,
  Ticker
} from 'pixi.js';
import PubSub from 'pubsub-js';
import {
  ACE_TRAY_W,
  BANK_STACK_ID,
  BOARD_Y,
  CARD_ANIM_SPEED_MS,
  CARD_H,
  CARD_OFFSET_HORIZONTAL,
  CARD_OFFSET_VERTICAL,
  CARD_W,
  COLOR_BG,
  DECK_CELL_ID,
  DECK_POS,
  GameEvent,
  Rank,
  STACK_GAP,
  Suit,
  VIEW_H,
  VIEW_W
} from './constants';
import AceTray from './entities/AceTray';
import Card, { CardClickData } from './entities/Card';
import Cell from './entities/Cell';
import Stack from './entities/Stack';
import { store } from './store';
import {
  getIndexOfSetInStack,
  isFirstCardAllowedOnSecond,
  isFoundationEmpty,
  isFoundationFull,
  rand,
  shouldAutoMoveTopCard,
  shuffleCards,
  stackIsSequential
} from './utils';

export default class Game {
  public animatedCards: Container<Card> | null = null;
  public app: Application | null = null;
  public bank: Container<Card> | null = null;
  public bankBg: Graphics | null = null;
  public board: Array<Stack> = [];
  public deck: Card[] = [];
  public deckCell: Cell | null = null;
  public deckSprites: Container | null = null;
  public foundation: AceTray[] = [];
  public gameElements: Container | null = null;
  public gratuitousSprites: Array<Container<Sprite>> = [];
  public hand: Container<Card> | null = null;
  public handOffset: [number, number] = [0, 0];
  // the stack or cell where the hand was picked up from
  public handOrigin: number | null = null;
  public isAnimatingDealing = false;
  public isAnimatingDeckDraw = false;
  public isAnimatingToFoundation = false;
  public isGameOver = false;
  public placeholders: Container[] = [];

  constructor() {
    this.app = new Application({
      width: VIEW_W,
      height: VIEW_H,
      resolution: window.devicePixelRatio || 1,
      backgroundColor: new Color(COLOR_BG).toNumber()
    });

    document.querySelector('.loader').remove();

    document
      .querySelector('#board')
      ?.append(this.app.view as HTMLCanvasElement);

    // init game elements container
    this.initGameElements();
    // init the aces tray
    this.initAceTray();
    // create the deck array in the store
    this.resetDeck();
    // create deck stack on the canvas
    this.displayDeck();
    // create the seven stacks
    this.createBoard();
    // create the card bank
    this.initBank();

    // init play again and reset buttons
    document.querySelector('.reset-button').removeAttribute('hidden');
    document
      .querySelectorAll('.game-over button, .reset-button')
      .forEach((el) => {
        el.addEventListener('click', () => {
          this.reset();
        });
      });

    // set up animated cards container
    this.animatedCards = new Container();
    this.gameElements.addChild(this.animatedCards);

    // start ticker
    Ticker.shared.add(this.update.bind(this));

    // deal all the cards to the board
    this.dealNextCard(0).then(() => {
      // listen for events
      this.listenForCardClick();
      // make the deck clickable
      this.listenForDeckClick();
      // move any aces
      this.checkForFoundationCards();
    });

    /**
     * The following commented code is for putting the game one play away from
     * endgame, making it easier to test endgame functions. To use it, comment
     * out the dealNextCard block above and uncomment the following.
     */
    // Object.values(Suit).forEach((suit) => {
    //   const tray = this.foundation.find((t) => t.suit === suit);
    //   Object.values(Rank).forEach((rank) => {
    //     const card = this.deck.find((card) => card.id === `${rank}_${suit}`);
    //     tray.addChild(card);
    //   });
    // });
    // this.deck = [];
    // const card = this.foundation[0].children.at(-1);
    // card.eventMode = 'static';
    // this.deckCell.addCard(card as Card);
    // this.deckCell.eventMode = 'static';
    // this.deckSprites.removeChildren();
    // // listen for events
    // this.listenForCardClick();
    // // make the deck clickable
    // this.listenForDeckClick();
    // // move any aces
    // this.checkForFoundationCards();
  }

  public addCardToAceTray(card: Card, duration = CARD_ANIM_SPEED_MS * 2) {
    return new Promise((resolve, reject) => {
      const tray = this.foundation.find((t) => t.suit === card.suit);
      const cardPos = card.getGlobalPosition();
      const trayPos = tray.getGlobalPosition();

      this.isAnimatingToFoundation = true;

      // move card
      anime({
        targets: card,
        x: trayPos.x - cardPos.x + card.x,
        y: trayPos.y - cardPos.y + card.y,
        easing: 'easeInOutSine',
        duration,
        complete: () => {
          // move card
          tray.add(card);
          card.x = 0;
          card.y = 0;

          this.isAnimatingToFoundation = false;

          resolve(true);
        }
      });
    });
  }

  public addChild(...children: DisplayObject[]) {
    this.app?.stage.addChild(...children);
  }

  public async checkForFoundationCards() {
    // check bank
    if (shouldAutoMoveTopCard(this.bank, this.foundation)) {
      await this.addCardToAceTray(this.bank.children.at(-1));
      this.refreshBank();
      this.checkForFoundationCards();
      return;
    }

    // check board
    this.board.forEach(async (stack) => {
      if (shouldAutoMoveTopCard(stack, this.foundation)) {
        await this.addCardToAceTray(stack.children.at(-1));
        this.checkForFoundationCards();
      }
    });

    // check free deck cell
    if (
      this.deckCell.card &&
      shouldAutoMoveTopCard(null, this.foundation, this.deckCell.card)
    ) {
      await this.addCardToAceTray(this.deckCell.card);
      this.checkForFoundationCards();
    }

    // check for win condition
    this.checkForWin();
  }

  public checkForWin() {
    const hasWon =
      !this.bank.children.length &&
      !this.deck.length &&
      !this.deckCell.card &&
      this.board.every((stack) => stackIsSequential(stack));

    if (!hasWon) {
      return;
    }

    this.isGameOver = true;
    this.gameOver();
  }

  public createBoard() {
    for (let i = 0; i < 7; i++) {
      const stack: Stack = new Stack(i);
      stack.x = DECK_POS.x;

      if (i > 0) {
        stack.x = DECK_POS.x + CARD_W * i + STACK_GAP * i;
      }

      stack.y = BOARD_Y;
      stack.eventMode = 'static';

      const cell = new Cell(i, stack.x, stack.y, CARD_W, CARD_H);
      this.gameElements.addChild(cell);

      this.board.push(stack);
    }

    this.gameElements.addChild(...this.board);
  }

  public dealNextCard(start = 0, col = 0) {
    return new Promise((resolve, reject) => {
      // get the top card
      const card = this.deck.pop();
      card.x = DECK_POS.x;
      card.y = DECK_POS.y - this.deckSprites.children.length * 0.5;

      this.deckSprites.children.pop().destroy();

      const stack = this.board[col];
      this.gameElements.addChild(card);

      col++;

      if (col === 7) {
        start++;
        col = start;
      }

      this.isAnimatingDealing = true;

      anime({
        targets: card,
        x: stack.x,
        y: stack.y + CARD_OFFSET_VERTICAL * (stack.children.length - 1),
        easing: 'easeInOutSine',
        duration: CARD_ANIM_SPEED_MS,
        complete: () => {
          stack.addChild(card);
          card.x = 0;
          card.y = CARD_OFFSET_VERTICAL * (stack.children.length - 1);
          card.eventMode = 'static';

          if (start < 7) {
            return this.dealNextCard(start, col).then(() => resolve(true));
          }

          this.isAnimatingDealing = false;
          resolve(true);
        }
      });
    });
  }

  public destroyHand() {
    if (!this.hand) {
      return [];
    }

    const cards = this.hand.children.splice(0);
    this.hand.destroy();
    this.hand = null;
    return cards;
  }

  public displayDeck() {
    // add the free cell
    this.deckCell = new Cell(
      DECK_CELL_ID,
      DECK_POS.x,
      DECK_POS.y,
      CARD_W,
      CARD_H
    );
    this.gameElements.addChild(this.deckCell);

    // create the deck sprites
    this.deckSprites = new Container();
    this.deckSprites.x = DECK_POS.x;
    this.deckSprites.y = DECK_POS.y;

    this.resetDeckSprites();

    this.gameElements.addChild(this.deckSprites);
  }

  public async gameOver() {
    this.gameElements.eventMode = 'none';
    let trayNum = 0;

    while (!isFoundationFull(this.foundation) && trayNum < 1000) {
      const tray = this.foundation.at(trayNum % 4);
      trayNum++;
      const idNeeded = tray.nextCardNeeded();

      const card = this.board.reduce((card: Card | null, stack, i) => {
        if (card || !stack.children.length) {
          return card;
        }

        return stack.children.at(-1).id === idNeeded
          ? stack.children.at(-1)
          : card;
      }, null);

      if (!card) {
        continue;
      }

      await this.addCardToAceTray(card, CARD_ANIM_SPEED_MS * 1.5);
    }

    document.querySelector('.game-over').classList.add('active');
    this.gameOverBonusAnimation();
  }

  public async gameOverBonusAnimation() {
    let trayNum = 0;

    while (!isFoundationEmpty(this.foundation) && trayNum < 1000) {
      const tray = this.foundation.at(trayNum % 4);

      if (!tray.isEmpty()) {
        const card = this.foundation[trayNum % 4].children.pop() as Card;
        const position = card.getGlobalPosition();
        this.animatedCards.addChild(card);

        card.x = position.x;
        card.y = position.y;
        card.velocityX = rand(1.5, 4);
        card.velocityY = rand(1.5, 3) * 1 + (trayNum % 4) * 1.1;
        card.ogVelocityY = card.velocityY;
        card.gravity = rand(0.05, 0.15);

        await (function () {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve(true);
            }, 4000);
          });
        })();
      }

      trayNum++;
    }
  }

  public getCardSet(selectedCard: Card): Card[] | false {
    const stack = this.board.find((stack) =>
      stack.children.find((card) => card.id === selectedCard.id)
    );
    const idx = getIndexOfSetInStack(stack, selectedCard);

    // if there is a set, removed the set from the stack and return it
    if (idx === false) {
      return false;
    }

    return stack.children.splice(idx);
  }

  public handleBankClick({ card, mouseEvent }: CardClickData) {
    if (this.hand) {
      return;
    }

    console.log('bank clicked');

    this.handOffset = [
      mouseEvent.globalX - this.bank.x,
      mouseEvent.globalY - this.bank.y
    ];

    this.handOrigin = BANK_STACK_ID;

    this.hand = new Container();
    this.hand.addChild(card);
    this.gameElements.addChild(this.hand);

    this.hand.x = store.mousePosition[0] - this.handOffset[0];
    this.hand.y = store.mousePosition[1] - this.handOffset[1];

    this.refreshBank();
  }

  public handleBoardClick({ card, mouseEvent }: CardClickData) {
    // get a reference to the stack before we removed the card(s) from it
    const stack = this.board.find((stack) =>
      stack.children.find((c) => c.id === card.id)
    );

    // this mutates the stack where the card(s) were found, removing then
    const set = this.getCardSet(card);

    if (!set) {
      return;
    }

    // tracking this offset allows the card to be grabbed from anywhere
    // without making it jump straight to the mouse position
    this.handOffset = [
      mouseEvent.globalX - stack.x,
      mouseEvent.globalY - stack.y
    ];

    // track where the hand came from so we can put it back if needed
    this.handOrigin = stack.id;

    this.hand = new Container();
    this.hand.addChild(...set);

    this.gameElements.addChild(this.hand);

    this.hand.x = store.mousePosition[0] - this.handOffset[0];
    this.hand.y = store.mousePosition[1] - this.handOffset[1];
  }

  public handleFreeCellClick({ card, mouseEvent }: CardClickData) {
    console.log('free cell clicked');

    this.handOffset = [
      mouseEvent.globalX - this.deckCell.x,
      mouseEvent.globalY - this.deckCell.y
    ];

    this.handOrigin = DECK_CELL_ID;

    this.hand = new Container();
    this.hand.addChild(card);
    this.deckCell.removeCard();
    this.gameElements.addChild(this.hand);

    this.hand.x = store.mousePosition[0] - this.handOffset[0];
    this.hand.y = store.mousePosition[1] - this.handOffset[1];
  }

  public handleHandClick({ card, mouseEvent }: CardClickData) {
    this.hand.eventMode = 'none';

    const boundary = new EventBoundary(this.gameElements);
    const point = card.getGlobalPosition();
    const obj: Card | Cell | DisplayObject = boundary.hitTest(
      point.x + CARD_W / 2,
      point.y + CARD_H / 4
    );

    this.hand.eventMode = 'static';

    console.log('hand hit test', obj, obj.name);

    // a card was clicked
    if (obj instanceof Card) {
      // is it on the board?
      const stack = this.board.find((s) =>
        s.children.find((c) => c.id === obj.id)
      );

      // a hand of multiple cards can only be placed on the board
      if (!stack && this.hand.children.length > 1) {
        return;
      }

      // allow placement on the bank if it matches the hand's origin
      if (!stack && this.bank.children.find((c) => c.id === obj.id)) {
        if (this.handOrigin === BANK_STACK_ID) {
          const cards = this.destroyHand();
          this.bank.addChild(cards[0]);
          this.refreshBank();
        }
        return;
      }

      // if stack is empty, place hand on stack
      if (stack && stack.children.length === 0) {
        const cards = this.destroyHand();
        stack.addCards(...cards);
        this.checkForFoundationCards();
        return;
      }

      // if it's the origin stack of the hand, allow placement
      if (stack?.id === this.handOrigin) {
        this.handOrigin = null;
        const cards = this.destroyHand();
        stack.addCards(...cards);
        return;
      }

      // attempt to place the card on the stack
      if (stack) {
        const top = stack.children.at(-1);

        if (!isFirstCardAllowedOnSecond(card, top)) {
          return;
        }

        const cards = this.destroyHand();
        stack.addCards(...cards);
        this.checkForFoundationCards();
        return;
      }

      return;
    }

    if (obj instanceof Cell) {
      // the deck cell can only hold one card
      if (obj.id === DECK_CELL_ID && this.hand.children.length > 1) {
        return;
      }

      // if this is the deck cell, place the card there
      if (obj.id === DECK_CELL_ID) {
        const cards = this.destroyHand();
        this.deckCell.addCard(cards[0]);
        this.checkForFoundationCards();
        return;
      }

      // if this is a free cell, attempt to place it on the corresponding stack
      const stack = this.board[obj.id];

      if (!stack || stack.children.length > 0) {
        return;
      }

      const cards = this.destroyHand();
      stack.addCards(...cards);
      this.checkForFoundationCards();
      return;
    }

    // if is the appropriate ace tray, attempt to place
    if (
      obj instanceof AceTray &&
      this.hand.children.length === 1 &&
      this.hand.children.at(0).suit === obj.suit
    ) {
      if (obj.add(this.hand.children.at(0))) {
        this.destroyHand();
        this.checkForFoundationCards();
      }
      return;
    }

    if (obj.name === 'bank_bg' && this.handOrigin === BANK_STACK_ID) {
      console.log('bank_bg play');
      const cards = this.destroyHand();
      this.bank.addChild(cards[0]);
      this.refreshBank();
    }
  }

  public initAceTray() {
    // create the dark background
    const bg = new Graphics();
    bg.beginFill('#00000033');
    bg.drawRect(0, 0, ACE_TRAY_W, VIEW_H);
    bg.endFill();
    this.gameElements.addChild(bg);

    Object.values(Suit).forEach((suit, idx) => {
      const tray = new AceTray(suit);
      tray.x = STACK_GAP;
      tray.y = STACK_GAP + idx * (CARD_H + STACK_GAP);
      this.foundation.push(tray);
      this.gameElements.addChild(tray);
    });
  }

  public initBank() {
    this.bank = new Container();
    this.bank.x = DECK_POS.x + CARD_W + STACK_GAP;
    this.bank.y = DECK_POS.y;

    this.bankBg = new Graphics();
    this.bankBg.name = 'bank_bg';
    this.bankBg.beginFill('#00000011');
    this.bankBg.drawRect(
      this.bank.x,
      this.bank.y,
      VIEW_W - this.bank.x - STACK_GAP,
      CARD_H
    );
    this.bankBg.endFill();

    this.bank.eventMode = 'static';
    this.bankBg.eventMode = 'static';
    this.gameElements.addChild(this.bankBg);
    this.gameElements.addChild(this.bank);
  }

  public initGameElements() {
    this.gameElements = new Container();
    this.gameElements.width = this.app.view.width;
    this.gameElements.height = this.app.view.height;
    this.gameElements.hitArea = new Rectangle(0, 0, VIEW_W, VIEW_H);

    this.gameElements.eventMode = 'static';
    this.gameElements.interactiveChildren = true;
    this.gameElements.addListener('pointermove', (event) => {
      store.mousePosition = [
        Math.round(event.globalX),
        Math.round(event.globalY)
      ];
      // document.querySelector('.mouse-x').innerHTML = event.globalX.toString();
      // document.querySelector('.mouse-y').innerHTML = event.globalY.toString();
    });

    this.addChild(this.gameElements);
  }

  public listenForCardClick() {
    PubSub.subscribe(
      GameEvent.CARD_CLICK,
      (msg: string, data: CardClickData) => {
        console.log(`clicked ${data.card.rank} of ${data.card.suit}`);
        if (this.isAnimatingToFoundation) {
          return;
        }

        // handle card clicks from the bank
        if (this.bank.children.find((c) => c.id === data.card.id)) {
          this.handleBankClick(data);
          return;
        }

        // handle card clicks on hand
        if (this.hand?.children.find((c) => c.id === data.card.id)) {
          this.handleHandClick(data);
          return;
        }

        // handle card click on the deck cell
        if (this.deckCell.card?.id === data.card.id) {
          this.handleFreeCellClick(data);
          return;
        }

        // handle card clicks on the board
        if (!this.hand) {
          this.handleBoardClick(data);
        }
      }
    );
  }

  public listenForDeckClick() {
    this.deckSprites.eventMode = 'static';
    this.deckSprites.addEventListener('pointertap', async (event) => {
      if (this.isAnimatingDeckDraw) {
        return;
      }

      this.isAnimatingDeckDraw = true;

      for (let i = 0; i < 3; i++) {
        if (!this.deck.length) {
          continue;
        }
        const card = this.deck.pop();
        this.bank.addChild(card);
        card.x = -STACK_GAP - CARD_W;
        card.y = -this.deckSprites.children.length * 0.5;
        await animateCard.bind(this)(card, i);
        card.eventMode = 'static';
      }

      this.isAnimatingDeckDraw = false;

      this.refreshBank();

      // if the deck is out of cards, activate the free cell
      if (!this.deck.length) {
        this.deckCell.eventMode = 'static';
      }

      function animateCard(card: Card, num: number) {
        return new Promise((resolve, reject) => {
          anime({
            targets: card,
            x: CARD_OFFSET_HORIZONTAL * (this.bank.children.length - 1),
            y: 0,
            duration: CARD_ANIM_SPEED_MS,
            easing: 'easeOutSine',
            changeBegin: () => {
              this.deckSprites.children.pop().destroy();
            },
            complete: () => {
              resolve(true);
            }
          });
        });
      }
    });
  }

  public refreshBank() {
    this.bank.children.forEach((card) => (card.eventMode = 'none'));

    if (this.bank.children.length) {
      this.bank.children.at(-1).eventMode = 'static';

      if (!this.hand) {
        this.checkForFoundationCards();
      }
    }
  }

  public reset() {
    // don't allow reset if there is a card in hand or gameplay animation is happening
    if (
      this.hand ||
      this.isAnimatingDealing ||
      this.isAnimatingDeckDraw ||
      this.isAnimatingToFoundation
    ) {
      return;
    }
    this.gameElements.eventMode = 'none';
    this.isGameOver = false;
    // destroy foundation cards
    this.foundation.forEach((tray) => tray.reset());
    // destroy board cards
    this.board.forEach((stack) => stack.removeChildren());
    // destroy bank cards
    this.bank.removeChildren();
    // destroy deck cell card
    this.deckCell.removeCard();
    // destroy animated cards and sprites
    this.animatedCards.removeChildren();
    this.gratuitousSprites.forEach((sprites) => {
      sprites.removeChildren();
      sprites.destroy();
    });
    this.gratuitousSprites = [];
    // prepared the deck
    this.resetDeck();
    // reset the deck sprites (card backs)
    this.resetDeckSprites();
    // deal the cards
    this.dealNextCard(0).then(() => {
      this.checkForFoundationCards();
      this.gameElements.eventMode = 'static';
    });
    // hide the game over screen
    document.querySelector('.game-over').classList.remove('active');
  }

  public resetDeck() {
    this.deck = [];

    Object.values(Rank).forEach((rank) => {
      Object.values(Suit).forEach((suit) => {
        this.deck.push(new Card(rank, suit));
      });
    });

    this.deck = shuffleCards(this.deck);
  }

  public resetDeckSprites() {
    this.deckSprites.removeChildren();

    this.deck.forEach((card, i) => {
      const sprite = new Sprite(store.spritesheet.textures['back_2']);
      sprite.width = CARD_W;
      sprite.height = CARD_H;
      sprite.x = 0;
      sprite.y = i === 0 ? 0 : 0 - i + 0.5 * i;
      this.deckSprites.addChild(sprite);
    });
  }

  public update(dt) {
    if (this.hand && !this.hand.destroyed) {
      this.hand.x = store.mousePosition[0] - this.handOffset[0];
      this.hand.y = store.mousePosition[1] - this.handOffset[1];
    }

    if (this.animatedCards.children.length) {
      this.animatedCards.children.forEach((card, i) => {
        if (!this.gratuitousSprites[i]) {
          this.gratuitousSprites[i] = new Container();
          this.gameElements.addChild(this.gratuitousSprites[i]);
        }

        if (card.isHidden) {
          return;
        }

        const sprite = new Sprite(
          store.spritesheet.textures[`${card.suit}_${card.rank}`]
        );
        this.gratuitousSprites[i].addChild(sprite);

        sprite.x = card.x;
        sprite.y = card.y;
        sprite.width = CARD_W;
        sprite.height = CARD_H;
      });
    }
  }
}
