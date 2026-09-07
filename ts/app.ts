import { Application, Assets, Color, Spritesheet, Texture } from 'pixi.js';
import deckData from '../images/deckData.json';
import { COLOR_BG } from './constants';
import Game from './Game2';
import { store } from './store';

export interface IAssets {
  deck: Texture;
}

export let game: Game | null = null;
export let app: Application | null = null;

init();

async function init() {
  // load everything and call main
  const texture = await Assets.load('images/deck.png');
  const sheet = new Spritesheet(texture, deckData);
  await sheet.parse();
  store.spritesheet = sheet;

  app = new Application();

  if (window.matchMedia('(min-width: 980px)').matches) {
    store.makeDesktopLayout();
  }

  await app.init({
    width: store.layout.VIEW_W,
    height: store.layout.VIEW_H,
    resolution: window.devicePixelRatio || 1,
    backgroundColor: new Color(COLOR_BG).toNumber()
  });

  game = new Game(app);
}
