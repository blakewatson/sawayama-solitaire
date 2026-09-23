import { DropShadowFilter } from 'pixi-filters';
import {
  Application,
  Container,
  Graphics,
  Point,
  Rectangle,
  Sprite
} from 'pixi.js';
import { app } from '../app';
import { BANK_BG, BANK_LABEL, DECK_CELL_LABEL, DECK_LABEL } from '../constants';
import Cell from '../entities/Cell';
import FoundationCell from '../entities/FoundationCell';
import Stack from '../entities/Stack';
import { store } from '../store';

export default class ViewController {
  app: Application;
  deckCell: Cell | null = null;
  deckSprites: Container | null = null;
  foundationBg: Graphics | null = null;
  isMobile = false;
  mainScene: Container;
  mainSceneClickHandler: EventListener;

  constructor(app: Application) {
    this.app = app;
    this.initLayout();
    this.initMainScene();
    this.initFoundation();
  }

  addChild(...children: Container[]) {
    this.mainScene.addChild(...children);
  }

  getDeckSprites(count: number) {
    const cardSprites = [];

    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(store.spritesheet.textures['back_red']);
      sprite.width = store.layout.CARD_W;
      sprite.height = store.layout.CARD_H;
      sprite.x = 0;
      sprite.y = 0;

      const spriteWrap = new Container();
      spriteWrap.x = 0;
      spriteWrap.y = i === 0 ? 0 : 0 - i + 0.5 * i;

      // The last card gets a drop shadow.
      if (i === count - 1) {
        const shadow = new DropShadowFilter({
          alpha: 0.05,
          blur: 1,
          offset: new Point(0, 1),
          resolution: app.renderer.resolution
        });
        spriteWrap.filters = [shadow];
      }

      spriteWrap.addChild(sprite);
      cardSprites.push(spriteWrap);
    }
    return cardSprites;
  }

  initBank() {
    const bank = new Stack(BANK_LABEL);
    bank.alignCardsAfterAdding = false;
    bank.x = store.layout.BANK_POS.x;
    bank.y = store.layout.BANK_POS.y;

    const bankBg = new Container();
    bankBg.label = BANK_BG;
    bankBg.x = bank.x;
    bankBg.y = bank.y;

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

    bankBg.addChild(bankBgGraphic);

    bank.eventMode = 'static';
    bankBg.eventMode = 'static';
    this.addChild(bankBg);
    this.addChild(bank);

    return bank;
  }

  initDeckCell() {
    // add the free cell
    const deckCell = new Cell(
      store.layout.DECK_POS.x,
      store.layout.DECK_POS.y,
      DECK_CELL_LABEL,
      true,
      store.layout.CARD_W,
      store.layout.CARD_H
    );

    this.addChild(deckCell);
    return deckCell;
  }

  initDeckSprites() {
    // create the deck sprites
    const deckSprites = new Container();
    deckSprites.label = DECK_LABEL;
    deckSprites.x = store.layout.DECK_POS.x;
    deckSprites.y = store.layout.DECK_POS.y;
    deckSprites.eventMode = 'static';

    this.deckSprites = deckSprites;
    this.addChild(deckSprites);

    return deckSprites;
  }

  initFoundation() {
    // create the dark background
    const bg = new Graphics();
    bg.rect(
      store.layout.FOUNDATION_BG_POS.x,
      store.layout.FOUNDATION_BG_POS.y,
      store.layout.FOUNDATION_W,
      store.layout.FOUNDATION_H
    );
    bg.fill('#00000033');
    this.foundationBg = bg;
    this.addChild(this.foundationBg);
  }

  initLayout() {
    if (window.matchMedia('(min-width: 550px)').matches) {
      console.log('DESKTOP');
      this.isMobile = false;
      return;
    } else {
      console.log('MOBILE1');
      this.isMobile = true;
      return;
    }
  }

  initMainScene() {
    const { VIEW_W, VIEW_H } = store.layout;
    this.mainScene = new Container();
    this.mainScene.width = this.app.canvas.width;
    this.mainScene.height = this.app.canvas.height;
    this.mainScene.hitArea = new Rectangle(0, 0, VIEW_W, VIEW_H);

    this.mainScene.eventMode = 'static';
    this.mainScene.interactiveChildren = true;

    if (!this.app) {
      return;
    }

    this.app.stage.addChild(this.mainScene);
  }

  positionFoundationTrays(foundation: FoundationCell[]) {
    const positionTray = (tray: FoundationCell, idx) => {
      if (this.isMobile) {
        tray.x =
          store.layout.VIEW_W -
          (store.layout.STACK_GAP + store.layout.CARD_W) * (idx + 1);
        tray.y = store.layout.DECK_POS.y;
        return;
      }

      tray.x = store.layout.STACK_GAP;
      tray.y =
        store.layout.STACK_GAP +
        idx * (store.layout.CARD_H + store.layout.STACK_GAP);
    };

    foundation.forEach(positionTray);
    this.addChild(...foundation);
  }

  removeChild(...children: Container[]) {
    this.mainScene.removeChild(...children);
  }
}
