import { effect } from '@preact/signals-core';
import { Application } from 'pixi.js';
import { store } from '../store';

export default class SettingsController {
  app: Application | null;
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
    ['#474680', 'East bay'],
    ['#534069', 'Muted plum'],
    ['#694040', 'Deep coffee'],
    ['#2e2f3b', 'Black rock'],
    ['#adaab3', 'Chatelle'],
    ['#377d21', 'WinXP']
  ];

  constructor(app: Application) {
    this.app = app;
    this.dialog = document.querySelector('[data-settings-dialog]');
    this.init();
  }

  closeDialog() {
    this.dialog.close();
  }

  init() {
    document
      .querySelector('[data-close-settings]')
      .addEventListener('click', () => {
        this.closeDialog();
      });

    const paletteWrap = document.querySelector('[data-palette]');

    this.palette.forEach((color) => {
      const label = document.createElement('label');
      label.textContent = color[1];
      label.style.backgroundColor = color[0];

      if (color[1] === 'Chatelle') {
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

    const existingSettings = localStorage.getItem('gameSettings');

    if (existingSettings) {
      const settings: any = JSON.parse(existingSettings);

      if (settings.backgroundColor) {
        store.settings.backgroundColor.value = settings.backgroundColor;
      }
    }

    effect(() => {
      this.app.renderer.background.color = store.settings.backgroundColor.value;

      localStorage.setItem(
        'gameSettings',
        JSON.stringify({
          backgroundColor: store.settings.backgroundColor.value
        })
      );
    });
  }

  openDialog() {
    this.dialog.showModal();
    console.log(`input[value="${store.settings.backgroundColor.value}]"`);
    const radio = document.querySelector(
      `input[value="${store.settings.backgroundColor.value}"]`
    ) as HTMLInputElement;
    radio.checked = true;
  }
}
