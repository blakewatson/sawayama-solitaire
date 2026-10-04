import { Ticker } from 'pixi.js';
import { HAND_STACK_LABEL } from '../constants';
import { store } from '../store';
import Stack from './Stack';

export default class Hand extends Stack {
  constructor() {
    super(HAND_STACK_LABEL);

    // start ticker
    Ticker.shared.add(this.update, this);
  }

  update(ticker: Ticker) {
    store.hand.x = store.mousePosition[0];
    store.hand.y = store.mousePosition[1];
  }
}
