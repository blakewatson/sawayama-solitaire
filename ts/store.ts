import { Spritesheet } from 'pixi.js';
import Card from './entities/Card';

interface IStore {
  board: Card[][];
  cardInHand: Card | null;
  deck: Card[];
  mousePosition: [number, number];
  spritesheet: Spritesheet | null;
}

export const store: IStore = {
  board: [[], [], [], [], [], [], []],
  cardInHand: null,
  deck: [],
  mousePosition: [0, 0],
  spritesheet: null
};
