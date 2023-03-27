import { Assets, Texture, Ticker } from 'pixi.js';
import Game from './Game';

export interface IAssets {
  deck: Texture;
}

init();

async function init() {
  // load everything and call main
  Assets.addBundle('graphics', {
    deck: 'images/deck.png'
  });

  const graphics = await Assets.loadBundle('graphics');

  main(graphics, Ticker.shared);
}

function main(graphics: IAssets, ticker: Ticker) {
  // start the game
  new Game(graphics, ticker);
}
