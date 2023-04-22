# Solitaire (Sawayama Rules)

This a web version of the Sawayama Solitaire mini game in Zachtronics’ [Last Call BBS](https://www.zachtronics.com/last-call-bbs/) and the [Zachtronics Solitaire Collection](https://www.zachtronics.com/solitaire-collection/).

I made this so I could quickly pop open a browser tab and play a game. I’m also learning game development with [PixiJS](https://pixijs.com/) and this seemed like a good project for my skill level at the time (April 2023).

A playable version exists at <https://www.watsonbrosgames.com/solitaire/>.

## Rules

Sawayama Solitaire follows regular Klondike rules, with the following changes:

- The tableau is face-up but, like Klondike, only top cards or cards in a sequence can be moved.
- Any card (not just kings) can go into an open cell.
- The deck can only be accessed once. After all cards have been drawn, it does not reset.
- After all the cards in the deck are gone, the spot where the deck sat becomes an open cell.
- Cards in the foundation can not be moved back onto the tableau.

## Running locally

I wanted to use the least amount of build step stuff as I could but I also wanted to use TypeScript. So I opted for using [esbuild](https://esbuild.github.io/). It’s just being used for TypeScript. I’m not bundling any styles.

The project uses PixiJS for rendering the game along with [Anime](https://animejs.com/) for animations.

Install dependencies:

```
npm install
```

Start the dev server. This will watch the project directory for changes (but you’ll still need to manually refresh the browser window to see them).

```
npm run watch
```

If you want to compile any changes to the JavaScript bundle, you can run:

```
npm run build
```

## Credits

- Game developed by [Blake Watson](https://blakewatson.com/)
- Sawayama Solitaire rules by [Zachtronics](https://www.zachtronics.com/solitaire-collection/)
- Card graphics from <https://github.com/deck-of-cards/standard-deck>
- (From standard-deck) Royals modified from: <https://commons.wikimedia.org/wiki/Category:SVG_English_pattern_playing_cards#/media/File:English_pattern_playing_cards_deck.svg>
- (From standard-deck) Suit icons are from Font Awesome Pro ([license](https://fontawesome.com/#pro-license-explained))
