import { Spritesheet } from 'pixi.js';

interface IStore {
  mousePosition: [number, number];
  spritesheet: Spritesheet | null;
}

export const store: IStore = {
  mousePosition: [0, 0],
  spritesheet: null
};
