import { Assets, Spritesheet, Texture } from 'pixi.js';
import deckData from '../images/deckData.json';
import Game from './Game';
import { store } from './store';

export interface IAssets {
  deck: Texture;
}

export let game: Game | null = null;

init();

async function init() {
  // load everything and call main
  const texture = await Assets.load('images/deck.png');
  const sheet = new Spritesheet(texture, deckData);
  await sheet.parse();
  store.spritesheet = sheet;

  game = new Game();
}
