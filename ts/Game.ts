import anime from 'animejs';
import {
  Application,
  Color,
  Container,
  DisplayObject,
  EventBoundary,
  Rectangle,
  Sprite,
  Ticker
} from 'pixi.js';
import PubSub from 'pubsub-js';
import {
  BOARD_Y,
  CARD_ANIM_SPEED_MS,
  CARD_H,
  CARD_OFFSET_VERTICAL,
  CARD_W,
  COLOR_BG,
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
import Stack from './entities/Stack';
import { store } from './store';
import {
  getIndexOfSetInStack,
  isFirstCardAllowedOnSecond,
  shuffleCards
} from './utils';

export default class Game {
  public aceTray: AceTray | null = null;
  public app: Application | null = null;
  public board: Array<Stack> = [];
  public deck: Card[] = [];
  public deckSprites: Container | null = null;
  public gameElements: Container | null = null;
  public hand: Container<Card> | null = null;
  public handOffset: [number, number] = [0, 0];

  constructor() {
    this.app = new Application({
      width: VIEW_W,
      height: VIEW_H,
      resolution: window.devicePixelRatio || 1,
      backgroundColor: new Color(COLOR_BG).toNumber()
    });

    document
      .querySelector('#board')
      ?.append(this.app.view as HTMLCanvasElement);

    // init game elements container
    this.initGameElements();
    // init the aces tray
    this.initAceTray();
    // create the deck array in the store
    this.createDeck();
    // create deck stack on the canvas
    this.displayDeck();
    // create the seven stacks
    this.createBoard();

    // start ticker
    Ticker.shared.add(this.update.bind(this));

    // deal all the cards to the board
    this.dealNextCard(0).then(() => {
      // listen for events
      this.listenForCardClick();
    });
  }

  public addChild(...children: DisplayObject[]) {
    this.app?.stage.addChild(...children);
  }

  public createBoard() {
    for (let i = 0; i < 7; i++) {
      const stack: Stack = new Stack();
      stack.x = DECK_POS.x;

      if (i > 0) {
        stack.x = DECK_POS.x + CARD_W * i + STACK_GAP * i;
      }

      stack.y = BOARD_Y;
      stack.eventMode = 'static';

      this.board.push(stack);
    }

    this.gameElements.addChild(...this.board);
  }

  public createDeck() {
    Object.values(Rank).forEach((rank) => {
      Object.values(Suit).forEach((suit) => {
        this.deck.push(new Card(rank, suit));
      });
    });

    this.deck = shuffleCards(this.deck);
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

          if (start < 7) {
            return this.dealNextCard(start, col).then(() => resolve(true));
          }

          resolve(true);
        }
      });
    });
  }

  public displayDeck() {
    this.deckSprites = new Container();
    this.deckSprites.x = DECK_POS.x;
    this.deckSprites.y = DECK_POS.y;

    this.deck.forEach((card, i) => {
      const sprite = new Sprite(store.spritesheet.textures['back_red']);
      sprite.width = CARD_W;
      sprite.height = CARD_H;
      sprite.x = 0;
      sprite.y = i === 0 ? 0 : 0 - i + 0.5 * i;
      this.deckSprites.addChild(sprite);
    });

    this.gameElements.addChild(this.deckSprites);
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

    this.hand = new Container();
    this.hand.addChild(...set);

    this.gameElements.addChild(this.hand);

    this.hand.x = store.mousePosition[0] - this.handOffset[0];
    this.hand.y = store.mousePosition[1] - this.handOffset[1];
  }

  public handleHandClick({ card, mouseEvent }: CardClickData) {
    console.log('hand click');
    // if multiple cards, only allow placement on board

    card.eventMode = 'none';
    const boundary = new EventBoundary(this.gameElements);
    const obj: Card | DisplayObject = boundary.hitTest(
      mouseEvent.globalX,
      mouseEvent.globalY
    );
    card.eventMode = 'static';

    // a card was clicked
    if (obj instanceof Card) {
      // is it on the board?
      const stack = this.board.find((s) =>
        s.children.find((c) => c.id === obj.id)
      );

      console.log('stack found', stack);

      // a hand of multiple cards can only be placed on the board
      if (!stack && this.hand.children.length > 1) {
        return;
      }

      // attempt to place the card on the stack
      if (stack) {
        const top = stack.children.at(-1);

        if (!isFirstCardAllowedOnSecond(card, top)) {
          return;
        }

        const cards = this.hand.children.splice(0);
        const hand = this.hand;
        this.hand = null;
        hand.destroy();

        stack.addCards(...cards);
      }
    }
  }

  public initAceTray() {
    this.aceTray = new AceTray();
    this.addChild(this.aceTray);
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
      document.querySelector('.mouse-x').innerHTML = event.globalX.toString();
      document.querySelector('.mouse-y').innerHTML = event.globalY.toString();
    });

    this.addChild(this.gameElements);
  }

  public listenForCardClick() {
    PubSub.subscribe(
      GameEvent.CARD_CLICK,
      (msg: string, data: CardClickData) => {
        console.log(`clicked ${data.card.rank} of ${data.card.suit}`);
        // todo: handle card clicks from the deck

        // todo: handle card clicks on hand
        if (this.hand?.children.find((c) => c.id === data.card.id)) {
          this.handleHandClick(data);
          return;
        }

        // handle card clicks on the board
        this.handleBoardClick(data);
      }
    );
  }

  public update(dt) {
    if (this.hand) {
      this.hand.x = store.mousePosition[0] - this.handOffset[0];
      this.hand.y = store.mousePosition[1] - this.handOffset[1];
    }
  }
}
