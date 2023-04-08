import anime from 'animejs';
import {
  Application,
  Color,
  Container,
  DisplayObject,
  Rectangle,
  Sprite
} from 'pixi.js';
import {
  BOARD_Y,
  CARD_H,
  CARD_OFFSET_VERTICAL,
  CARD_W,
  COLOR_BG,
  DECK_POS,
  Rank,
  STACK_GAP,
  Suit,
  VIEW_H,
  VIEW_W
} from './constants';
import AceTray from './entities/AceTray';
import Card from './entities/Card';
import { store } from './store';
import { shuffleCards } from './utils';

export default class Game {
  public aceTray: AceTray | null = null;
  public app: Application | null = null;
  public boardContainers: Container[] = [];
  public deckSprites: Container | null = null;
  public gameElements: Container | null = null;

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
    // deal all the cards to the board
    this.createBoard();
  }

  public addChild(...children: DisplayObject[]) {
    this.app?.stage.addChild(...children);
  }

  public createBoard() {
    store.board = [[], [], [], [], [], [], []];

    store.board.forEach((_, i) => {
      const stack = new Container();
      stack.x = DECK_POS.x;

      if (i > 0) {
        stack.x = DECK_POS.x + CARD_W * i + STACK_GAP * i;
      }

      stack.y = BOARD_Y;

      this.boardContainers.push(stack);
      this.gameElements.addChild(this.boardContainers[i]);
    });

    function dealNextCard(game: Game, start = 0, col = 0) {
      // get the top card
      const card = store.deck.pop();
      card.x = DECK_POS.x;
      card.y = DECK_POS.y - game.deckSprites.children.length * 0.5;
      game.deckSprites.children.pop().destroy();

      const stack = game.boardContainers[col];

      game.gameElements.addChild(card);

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
        duration: 100,
        complete: () => {
          stack.addChild(card);
          card.x = 0;
          card.y = CARD_OFFSET_VERTICAL * (stack.children.length - 1);

          if (start < 7) {
            dealNextCard(game, start, col);
          }
        }
      });
    }

    dealNextCard(this, 0);
  }

  public createDeck() {
    Object.values(Rank).forEach((rank) => {
      Object.values(Suit).forEach((suit) => {
        store.deck.push(new Card(rank, suit));
      });
    });

    store.deck = shuffleCards(store.deck);
  }

  public displayDeck() {
    this.deckSprites = new Container();
    this.deckSprites.x = DECK_POS.x;
    this.deckSprites.y = DECK_POS.y;

    store.deck.forEach((card, i) => {
      const sprite = new Sprite(store.spritesheet.textures['back_red']);
      sprite.width = CARD_W;
      sprite.height = CARD_H;
      sprite.x = 0;
      sprite.y = i === 0 ? 0 : 0 - i + 0.5 * i;
      this.deckSprites.addChild(sprite);
    });

    this.gameElements.addChild(this.deckSprites);
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
      store.mousePosition = [event.globalX, event.globalY];
      document.querySelector('.mouse-x').innerHTML = event.globalX.toString();
      document.querySelector('.mouse-y').innerHTML = event.globalY.toString();
    });

    this.addChild(this.gameElements);
  }
}
