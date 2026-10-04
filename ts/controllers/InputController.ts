import { Container, ContainerChild, EventBoundary } from 'pixi.js';
import { CARD_DRAG_THRESHOLD } from '../constants';
import Card from '../entities/Card';
import Cell from '../entities/Cell';
import { store } from '../store';
import ViewController from './ViewController';

export enum InputState {
  IDLE = 'IDLE',
  PRESSED = 'PRESSED',
  DRAGGING = 'DRAGGING'
}

export interface InputActions {
  redo: () => void;
  reset: () => void;
  showSettings: () => void;
  tryRelease: (obj: Card | Cell | Container) => void;
  trySelect: (obj: Card | Cell | Container) => void;
  undo: () => void;
}

export default class InputController {
  actions: InputActions | null = null;
  buttons: HTMLButtonElement[] = [];
  currentState = InputState.IDLE;
  lastPressedPosition: [number, number] = [0, 0];
  view: ViewController | null = null;

  constructor(view: ViewController, actions: InputActions) {
    this.view = view;
    this.actions = actions;
    this.init();
  }

  disableUndoRedo() {
    this.buttons.forEach((btn) => {
      if ('undo' in btn.dataset || 'redo' in btn.dataset) {
        btn.disabled = true;
      }
    });
  }

  getHandIntersection(): Container<ContainerChild> | null {
    if (!store.hand.count) {
      return null;
    }

    // If there are cards in hand then we're looking for where the top
    // center-ish of the card is overlapping. Otherwise we're looking at where
    // the mouse pointer is overlapping.
    const boundary = new EventBoundary(this.view.mainScene);

    const card = store.hand.children[0];

    // This checks what, if anything, the top center-ish area of the topmost
    // card in the hand is intersecting.
    const point = card.getGlobalPosition();
    const obj: Card | Cell | Container = boundary.hitTest(
      point.x + store.layout.CARD_W / 2,
      point.y + store.layout.CARD_H / 4
    );
    return obj;
  }

  init() {
    this.view.mainScene.addEventListener('pointermove', (event) => {
      store.mousePosition = [
        Math.round(event.globalX),
        Math.round(event.globalY)
      ];

      if (this.currentState !== InputState.PRESSED) {
        return;
      }

      if (
        Math.abs(event.globalX - this.lastPressedPosition[0]) >
          CARD_DRAG_THRESHOLD ||
        Math.abs(event.globalY - this.lastPressedPosition[1]) >
          CARD_DRAG_THRESHOLD
      ) {
        this.currentState = InputState.DRAGGING;
      }
    });

    this.view.mainScene.addEventListener('pointerdown', (event) => {
      store.mousePosition = [
        Math.round(event.globalX),
        Math.round(event.globalY)
      ];

      this.lastPressedPosition = [event.globalX, event.globalY];

      store.hand.position.set(...store.mousePosition);

      this.currentState = InputState.PRESSED;

      this.view.app.render();

      if (store.hand.count > 0) {
        const obj = this.getHandIntersection();

        this.actions.tryRelease(obj);
        return;
      }

      const boundary = new EventBoundary(this.view.mainScene);
      const obj: Card | Cell | Container = boundary.hitTest(
        ...store.mousePosition
      );

      this.actions.trySelect(obj);
    });

    this.view.mainScene.addEventListener('pointerup', (event) => {
      if (this.currentState === InputState.PRESSED) {
        this.currentState = InputState.IDLE;

        if (event.pointerType !== 'mouse') {
          const obj = this.getHandIntersection();
          this.actions.tryRelease(obj);
        }

        return;
      }

      if (this.currentState === InputState.DRAGGING) {
        if (store.hand.count > 0) {
          const obj = this.getHandIntersection();

          this.actions.tryRelease(obj);
        }

        this.currentState = InputState.IDLE;
        return;
      }
    });
  }

  initDomUi() {
    // show the row of buttons
    document.querySelector('.buttons').removeAttribute('hidden');

    this.buttons = Array.from(document.querySelectorAll('button'));

    this.buttons.forEach((btn) => {
      if ('undo' in btn.dataset) {
        btn.addEventListener('click', () => {
          this.actions.undo();
        });
      }

      if ('redo' in btn.dataset) {
        btn.addEventListener('click', () => {
          this.actions.redo();
        });
      }

      if ('reset' in btn.dataset) {
        btn.addEventListener('click', () => {
          this.actions.reset();
        });

        btn.removeAttribute('disabled');
      }

      if ('settings' in btn.dataset) {
        btn.addEventListener('click', () => {
          this.actions.showSettings();
        });
        btn.disabled = false;
      }
    });

    // Disable the undo and redo buttons as needed when the moves and movesCache
    // arrays change.
    store.moves.subscribe((moves) => {
      this.buttons.forEach((btn) => {
        if ('undo' in btn.dataset) {
          btn.disabled = moves.length === 0;
        }
      });
    });

    store.movesCache.subscribe((movesCache) => {
      this.buttons.forEach((btn) => {
        if ('redo' in btn.dataset) {
          btn.disabled = movesCache.length === 0;
        }
      });
    });
  }
}
