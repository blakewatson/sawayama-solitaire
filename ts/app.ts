import { Application, Assets, Color, Spritesheet, Texture } from 'pixi.js';
import deckData from '../images/deckData.json';
import { COLOR_BG, VIEW_H, VIEW_W } from './constants';
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

  const app = new Application();

  await app.init({
    width: VIEW_W,
    height: VIEW_H,
    resolution: window.devicePixelRatio || 1,
    backgroundColor: new Color(COLOR_BG).toNumber()
  });

  game = new Game(app);
}
