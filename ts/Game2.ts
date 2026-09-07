import { animate, createTimeline, stagger } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import {
	Application,
	Container,
	Graphics,
	Point,
	Rectangle,
	Sprite
} from 'pixi.js';
import PubSub from 'pubsub-js';
import { app } from './app';
import {
	CARD_ANIM_SPEED_MS,
	DECK_CELL_ID,
	GameEvent,
	Rank,
	Suit
} from './constants';
import AceTray from './entities/AceTray';
import Card, { CardClickData } from './entities/Card';
import Cell from './entities/Cell';
import Stack from './entities/Stack';
import { DeckDraw, GameMove, MoveType, store } from './store';
import { shuffleCards } from './utils';

export default class Game {
	app: Application | null = null;
	bank: Container<Card> | null = null;
	bankBg: Container<Graphics> | null = null;
	board: Cell[] = [];
	deck: Card[] = [];
	deckCell: Cell | null = null;
	deckSprites: Container | null = null;
	foundation: AceTray[] = [];
	foundationBg: Graphics | null;
	hand: Stack | null = null;
	isAnimatingDealing = false;
	isAnimatingDeckDraw = false;
	isMoving = false;
	scene: Container | null = null;

	constructor(app: Application) {
		this.app = app;

		document.querySelector('.loader').remove();

		document
			.querySelector('#board')
			?.append(this.app.canvas as HTMLCanvasElement);

		// set up the main container
		this.initMainScene();
		// set up the foundation (aces)
		this.initFoundation();
		// create the deck array in the store
		this.resetDeck();
		// create deck stack on the canvas
		this.displayDeck();
		// create the seven stacks
		this.createBoard();
		// create the card bank
		this.initBank();

		this.dealCards().then(() => {
			this.listenForCardClick();
			this.listenForDeckClick();
			this.initDomUi();
		});

		// const cardA = new Card(Rank.Three, Suit.Diamonds);
		// this.board.at(0).addCard(cardA);
	}

	addChild(...children: Container[]) {
		this.scene.addChild(...children);
	}

	createBoard() {
		for (let i = 0; i < 7; i++) {
			let x = store.layout.DECK_POS.x;

			if (i > 0) {
				x =
					store.layout.DECK_POS.x +
					store.layout.CARD_W * i +
					store.layout.STACK_GAP * i;
			}

			const y = store.layout.BOARD_Y;

			const cell = new Cell(i, x, y);

			this.board.push(cell);
		}

		this.addChild(...this.board);
	}

	async dealCards() {
		let rowStartsAtCol = 0;
		let col = 0;

		for (let count = 0; count < 28; count++) {
			await this.dealNextCard(col);

			// go to the next cell
			col++;

			// if we’re past the last cell, start the next row one cell over
			if (col === 7) {
				rowStartsAtCol++;
				col = rowStartsAtCol;
			}
		}
	}

	dealNextCard(col = 0) {
		return new Promise((resolve, reject) => {
			// get the top card
			const card = this.deck.pop();
			card.x = store.layout.DECK_POS.x;
			card.y = store.layout.DECK_POS.y - this.deckSprites.children.length * 0.5;

			// make the deck visibly smaller
			this.deckSprites.children.pop();

			const cell = this.board[col];
			this.addChild(card);

			// col++;

			// if (col === 7) {
			//   start++;
			//   col = start;
			// }

			this.isAnimatingDealing = true;

			animate(card, {
				x: cell.x,
				y: cell.nextCardPosY,
				ease: 'easeInOutSine',
				duration: CARD_ANIM_SPEED_MS,
				onComplete: () => {
					cell.addCard(card); // moves the card to new container
					card.x = 0;
					card.y = 0;
					cell.alignCards();
					// card.y = store.layout.CARD_OFFSET_VERTICAL * (cell.children.length - 1);
					card.eventMode = 'static';

					// if (start < 7) {
					//   return this.dealNextCard(start, col).then(() => resolve(true));
					// }

					this.isAnimatingDealing = false;
					resolve(true);
				}
			});
		});
	}

	displayDeck() {
		// add the free cell
		this.deckCell = new Cell(
			DECK_CELL_ID,
			store.layout.DECK_POS.x,
			store.layout.DECK_POS.y,
			store.layout.CARD_W,
			store.layout.CARD_H
		);
		this.addChild(this.deckCell);

		// create the deck sprites
		this.deckSprites = new Container();
		this.deckSprites.x = store.layout.DECK_POS.x;
		this.deckSprites.y = store.layout.DECK_POS.y;

		this.resetDeckSprites();

		this.addChild(this.deckSprites);
	}

	async drawFromDeck() {
		if (this.isAnimatingDeckDraw || this.isAnimatingDealing) {
			return;
		}

		this.isAnimatingDeckDraw = true;

		for (let i = 0; i < 3; i++) {
			if (!this.deck.length) {
				continue;
			}
			const card = this.deck.pop();
			this.bank.addChild(card);
			card.x = -store.layout.STACK_GAP - store.layout.CARD_W;
			card.y = -this.deckSprites.children.length * 0.5;
			await animateCard.bind(this)(card, i);
			card.eventMode = 'static';
		}

		this.isAnimatingDeckDraw = false;

		this.refreshBank();

		// if the deck is out of cards, activate the free cell
		if (!this.deck.length) {
			this.deckCell.eventMode = 'static';
		}

		function animateCard(card: Card, num: number) {
			return new Promise((resolve, reject) => {
				animate(card, {
					x:
						store.layout.CARD_OFFSET_HORIZONTAL *
						(this.bank.children.length - 1),
					y: 0,
					duration: CARD_ANIM_SPEED_MS,
					ease: 'easeOutSine',
					onChangeBegin: () => {
						this.deckSprites.removeChildAt(
							this.deckSprites.children.length - 1
						);
					},
					onComplete: () => {
						resolve(true);
					}
				});
			});
		}
	}

	initBank() {
		this.bank = new Container();
		this.bank.x =
			store.layout.DECK_POS.x + store.layout.CARD_W + store.layout.STACK_GAP;
		this.bank.y = store.layout.DECK_POS.y;

		this.bankBg = new Container();
		this.bankBg.label = 'bank_bg';
		const bankBgGraphic = new Graphics();
		bankBgGraphic.rect(
			this.bank.x,
			this.bank.y,
			store.layout.VIEW_W - this.bank.x - store.layout.STACK_GAP,
			store.layout.CARD_H
		);
		bankBgGraphic.fill('#00000011');
		this.bankBg.addChild(bankBgGraphic);

		this.bank.eventMode = 'static';
		this.bankBg.eventMode = 'static';
		this.addChild(this.bankBg);
		this.addChild(this.bank);

		PubSub.subscribe(GameEvent.RESIZE, () => {
			this.bank.x =
				store.layout.DECK_POS.x + store.layout.CARD_W + store.layout.STACK_GAP;

			this.bank.y = store.layout.DECK_POS.y;

			this.bankBg[0].width =
				store.layout.VIEW_W - this.bank.x - store.layout.STACK_GAP;

			this.bankBg[0].height = store.layout.CARD_H;
		});
	}

	initDomUi() {
		// show the row of buttons
		document.querySelector('.buttons').removeAttribute('hidden');

		// undo
		document.querySelector('[data-undo]').addEventListener('click', () => {
			if (
				this.isAnimatingDealing ||
				this.isAnimatingDeckDraw ||
				this.isMoving
			) {
				return;
			}

			this.moveUndo();
		});

		// redo
		document.querySelector('[data-redo]').addEventListener('click', () => {
			if (
				this.isAnimatingDealing ||
				this.isAnimatingDeckDraw ||
				this.isMoving
			) {
				return;
			}

			this.moveRedo();
		});

		// reset
		document
			.querySelectorAll('.game-over button, .reset-button')
			.forEach((el) => {
				el.addEventListener('click', () => {
					// this.reset();
				});
			});
	}

	initFoundation() {
		// create the dark background
		const bg = new Graphics();
		bg.rect(0, 0, store.layout.ACE_TRAY_W, store.layout.ACE_TRAY_H);
		bg.fill('#00000033');
		this.foundationBg = bg;
		this.addChild(this.foundationBg);

		const positionTray = (tray: AceTray, idx) => {
			tray.x = store.layout.STACK_GAP;
			tray.y =
				store.layout.STACK_GAP +
				idx * (store.layout.CARD_H + store.layout.STACK_GAP);
		};

		Object.values(Suit).forEach((suit, idx) => {
			const tray = new AceTray(suit);
			this.foundation.push(tray);
		});

		this.foundation.forEach(positionTray);
		this.addChild(...this.foundation);

		PubSub.subscribe(GameEvent.RESIZE, () => {
			this.foundationBg.width = store.layout.ACE_TRAY_W;
			this.foundationBg.height = store.layout.ACE_TRAY_H;
			this.foundation.forEach(positionTray);
		});
	}

	initMainScene() {
		const { VIEW_W, VIEW_H } = store.layout;
		this.scene = new Container();
		this.scene.width = this.app.canvas.width;
		this.scene.height = this.app.canvas.height;
		this.scene.hitArea = new Rectangle(0, 0, VIEW_W, VIEW_H);

		this.scene.eventMode = 'static';
		this.scene.interactiveChildren = true;
		this.scene.addListener('pointermove', (event) => {
			store.mousePosition = [
				Math.round(event.globalX),
				Math.round(event.globalY)
			];
		});

		if (!this.app) {
			return;
		}

		this.app.stage.addChild(this.scene);

		PubSub.subscribe(GameEvent.RESIZE, () => {
			this.scene.width = store.layout.VIEW_W;
			this.scene.height = store.layout.VIEW_H;
			this.scene.hitArea = new Rectangle(
				0,
				0,
				store.layout.VIEW_W,
				store.layout.VIEW_H
			);
		});
	}

	listenForCardClick() {
		PubSub.subscribe(
			GameEvent.CARD_CLICK,
			(msg: string, data: CardClickData) => {
				console.log(`clicked ${data.card.rank} of ${data.card.suit}`);
				console.log(data);
			}
		);
	}

	listenForDeckClick() {
		this.deckSprites.eventMode = 'static';
		this.deckSprites.addEventListener('pointertap', async (event) => {
			if (this.isAnimatingDeckDraw || this.isAnimatingDealing) {
				return;
			}

			if (this.deck.length < 3) {
				return;
			}

			const cards = this.deck.slice(-3);

			this.moveAdd({
				type: MoveType.DECK_DRAW,
				cards
			});
		});
	}

	async moveAdd(move: GameMove, resetCache = true) {
		if (resetCache) {
			store.movesCache = [];
		}

		if (move.type === MoveType.DECK_DRAW) {
			store.moves.push(move);
			await this.drawFromDeck();
			return;
		}
	}

	async moveRedo() {
		if (!store.movesCache.length) {
			return;
		}

		const move = store.movesCache.pop();
		this.moveAdd(move, false);
	}

	async moveUndo() {
		if (!store.moves.length) {
			return;
		}

		const move = store.moves.pop();
		store.movesCache.push(move);

		if (move.type === MoveType.DECK_DRAW) {
			await this.undoDeckDraw(move);
		}
	}

	refreshBank() {
		this.bank.children.forEach((card) => (card.eventMode = 'none'));

		if (this.bank.children.length) {
			this.bank.children.at(-1).eventMode = 'static';

			if (!this.hand) {
				// this.checkForFoundationCards();
			}
		}
	}

	resetDeck() {
		this.deck = [];

		Object.values(Rank).forEach((rank) => {
			Object.values(Suit).forEach((suit) => {
				this.deck.push(new Card(rank, suit));
			});
		});

		this.deck = shuffleCards(this.deck);
	}

	resetDeckSprites() {
		this.deckSprites.removeChildren();

		this.deck.forEach((card, i) => {
			const sprite = new Sprite(store.spritesheet.textures['back_red']);
			sprite.width = store.layout.CARD_W;
			sprite.height = store.layout.CARD_H;
			sprite.x = 0;
			sprite.y = 0;

			const spriteWrap = new Container();
			spriteWrap.x = 0;
			spriteWrap.y = i === 0 ? 0 : 0 - i + 0.5 * i;

			// The last card gets a drop shadow.
			if (i === this.deck.length - 1) {
				const shadow = new DropShadowFilter({
					alpha: 0.05,
					blur: 1,
					offset: new Point(0, 1),
					resolution: app.renderer.resolution
				});
				spriteWrap.filters = [shadow];
			}

			spriteWrap.addChild(sprite);

			this.deckSprites.addChild(spriteWrap);
		});
	}

	async redoDeckDraw() {
		if (this.deck.length < 3) {
			return;
		}

		const cards = this.deck.slice(-3);

		this.moveAdd({
			type: MoveType.DECK_DRAW,
			cards
		});
	}

	undoDeckDraw(move: DeckDraw) {
		return new Promise((resolve, reject) => {
			const start = this.bank.children.length - 3;
			this.bank.removeChildren(start);
			this.deck.push(...move.cards);
			this.resetDeckSprites();

			requestAnimationFrame(() => {
				const cards = this.deckSprites.children;

				const tl = createTimeline({
					duration: 1000,
					onComplete: () => {
						resolve(true);
					}
				});

				tl.add(cards, {
					y: '-=10',
					duration: 100,
					ease: 'outSine'
				});

				tl.add(cards, {
					y: '+=10',
					duration: 100,
					ease: 'outSine',
					delay: stagger(10)
				});
			});
		});
	}
}
