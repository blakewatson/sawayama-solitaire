import { Application, Container, Graphics, Rectangle } from 'pixi.js';
import { GameEvent } from '../constants';
import AceTray from '../entities/AceTray';
import { store } from '../store';

export default class ViewController {
  app: Application;
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

  initFoundation() {
    // create the dark background
    const bg = new Graphics();
    bg.rect(0, 0, store.layout.ACE_TRAY_W, store.layout.ACE_TRAY_H);
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

    this.mainScene.addEventListener('pointermove', (event) => {
      store.mousePosition = [
        Math.round(event.globalX),
        Math.round(event.globalY)
      ];
    });

    // Using the DOM style method on purpose so we can attach this handler to
    // the capture phase. This is needed because main scene clicks need the
    // option to stop propagation.
    this.mainScene.addEventListener(
      'pointerdown',
      (event) => {
        if (!store.hand.count) {
          return;
        }

        event.stopImmediatePropagation();

        PubSub.publish(GameEvent.MAIN_SCENE_CLICK);
      },
      { capture: true }
    );

    if (!this.app) {
      return;
    }

    this.app.stage.addChild(this.mainScene);
    `.ww1`;
    // PubSub.subscribe(GameEvent.RESIZE, () => {.wi
    //   this.mainScene.width = store.layout.VIEW_W;
    //   this.mainScene.height = store.layout.VIEW_H;
    //   this.mainScene.hitArea = new Rectangle(
    //     0,
    //     0,
    //     store.layout.VIEW_W,
    //     store.layout.VIEW_H
    //   );
    // });
  }

  positionFoundationTrays(foundation: AceTray[]) {
    const positionTray = (tray: AceTray, idx) => {
      if (this.isMobile) {
        tray.x =
          store.layout.VIEW_W -
          (store.layout.STACK_GAP + store.layout.CARD_W) * (idx + 1);
        tray.y = store.layout.STACK_GAP;
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
