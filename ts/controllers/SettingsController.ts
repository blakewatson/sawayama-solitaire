import { effect } from '@preact/signals-core';
import { Application } from 'pixi.js';
import { store } from '../store';
import ViewController from './ViewController';

export default class SettingsController {
  app: Application | null;
  cardBacks: string[][] = [
    ['back_red', 'Red'],
    ['back_green', 'Green'],
    ['back_blue', 'Blue']
  ];
  dialog: HTMLDialogElement | null = null;
  palette: string[][] = [
    ['#505459', 'Default'],
    ['#3b302e', 'Havana'],
    ['#524e4b', 'Ship gray'],
    ['#61695a', 'Siam'],
    ['#385237', 'Goblin'],
    ['#406949', 'Killarney'],
    ['#37524a', 'Dark slate gray'],
    ['#4b524f', 'Dark slate'],
    ['#374552', 'Oxford blue'],
    ['#4a698f', 'Wedgewood'],
    ['#474680', 'East bay'],
    ['#534069', 'Muted plum'],
    ['#3b2e36', 'Tuatara'],
    ['#2e2f3b', 'Black rock'],
    ['#694040', 'Deep coffee'],
    ['#bd8fa9', 'Opera mauve'],
    ['#947fb5', 'Lavender'],
    ['#8fb4bd', 'Nepal'],
    ['#adaab3', 'Chatelle'],
    ['#b3b0aa', 'Bombay'],
    ['#377d21', 'WinXP']
  ];
  view: ViewController | null = null;

  constructor(app: Application, view: ViewController) {
    this.app = app;
    this.view = view;
    this.dialog = document.querySelector('[data-settings-dialog]');
    this.init();
  }

  closeDialog() {
    this.dialog.close();
  }

  init() {
    this.initStoreSettings();
    this.initBackgroundPicker();
    this.initCardBackPicker();

    document
      .querySelector('[data-close-settings]')
      .addEventListener('click', () => {
        this.closeDialog();
      });
  }

  initBackgroundPicker() {
    const paletteWrap = document.querySelector('[data-palette]');

    this.palette.forEach((color) => {
      const label = document.createElement('label');
      label.textContent = color[1];
      label.style.backgroundColor = color[0];

      if (
        ['Chatelle', 'Bombay', 'Opera mauve', 'Nepal', 'Lavender'].includes(
          color[1]
        )
      ) {
        label.style.color = 'Black';
      }

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.value = color[0];
      radio.name = 'color';

      radio.addEventListener('change', (event) => {
        store.settings.backgroundColor.value = (
          event.target as HTMLInputElement
        ).value;
      });

      label.prepend(radio);
      paletteWrap.appendChild(label);
    });
  }

  initCardBackPicker() {
    const cardBacksWrap = document.querySelector('[data-card-back]');

    this.cardBacks.forEach((back) => {
      const label = document.createElement('label');
      label.textContent = back[1];

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.value = back[0];
      radio.name = 'card-back';

      radio.addEventListener('change', (event) => {
        store.settings.cardBack.value = (
          event.target as HTMLInputElement
        ).value;
      });

      label.prepend(radio);
      cardBacksWrap.appendChild(label);
    });
  }

  initStoreSettings() {
    const existingSettings = localStorage.getItem('gameSettings');

    if (existingSettings) {
      const settings: any = JSON.parse(existingSettings);

      if (settings.backgroundColor) {
        store.settings.backgroundColor.value = settings.backgroundColor;
      }

      if (settings.cardBack) {
        store.settings.cardBack.value = settings.cardBack;
      }
    }

    effect(() => {
      this.app.renderer.background.color = store.settings.backgroundColor.value;
      this.view.setCardBack(store.settings.cardBack.value);

      localStorage.setItem(
        'gameSettings',
        JSON.stringify({
          backgroundColor: store.settings.backgroundColor.value,
          cardBack: store.settings.cardBack.value
        })
      );
    });
  }

  openDialog() {
    this.dialog.showModal();

    const bgRadio = document.querySelector(
      `input[value="${store.settings.backgroundColor.value}"]`
    ) as HTMLInputElement;
    bgRadio.checked = true;

    const cardBackRadio = document.querySelector(
      `input[value="${store.settings.cardBack.value}"]`
    ) as HTMLInputElement;
    cardBackRadio.checked = true;
  }
}
