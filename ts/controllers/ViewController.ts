import { Application, Container, Rectangle } from 'pixi.js';
import { GameEvent } from '../constants';
import { store } from '../store';

export default class ViewController {
  app: Application;
  mainScene: Container;
  mainSceneClickHandler: EventListener;

  constructor(app: Application) {
    this.app = app;
    this.initMainScene();
  }

  addChild(...children: Container[]) {
    this.mainScene.addChild(...children);
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

    PubSub.subscribe(GameEvent.RESIZE, () => {
      this.mainScene.width = store.layout.VIEW_W;
      this.mainScene.height = store.layout.VIEW_H;
      this.mainScene.hitArea = new Rectangle(
        0,
        0,
        store.layout.VIEW_W,
        store.layout.VIEW_H
      );
    });
  }

  removeChild(...children: Container[]) {
    this.mainScene.removeChild(...children);
  }
}
