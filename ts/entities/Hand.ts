import { HAND_STACK_LABEL } from '../constants';
import Stack from './Stack';

export default class Hand extends Stack {
  constructor() {
    super(HAND_STACK_LABEL);
  }
}
