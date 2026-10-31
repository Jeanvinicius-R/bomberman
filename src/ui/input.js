// Entrada: teclado (computador) e direcional + botão de bomba (toque).
import { DIRS } from '../config.js';

const KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
const DEAD_ZONE = 14;
const ARROW_CLASS = new Map([[DIRS.up, 'u'], [DIRS.down, 'd'], [DIRS.left, 'l'], [DIRS.right, 'r']]);

export class Input {
  constructor({ dpad, bombBtn, onBomb, onPauseKey }) {
    this.held = [];
    this.padDir = null;
    this.dpad = dpad;
    this.arrows = [...dpad.querySelectorAll('span')];
    this.rect = null;

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = KEYS[e.code];
      if (k) {
        e.preventDefault();
        if (!this.held.includes(k)) this.held.push(k);
      } else if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        onBomb();
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        onPauseKey();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYS[e.code];
      if (k) this.held = this.held.filter((h) => h !== k);
    });
    window.addEventListener('blur', () => this.reset());

    dpad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dpad.setPointerCapture(e.pointerId);
      this.rect = dpad.getBoundingClientRect(); // lido uma vez por toque, não a cada movimento
      this.padMove(e);
    });
    dpad.addEventListener('pointermove', (e) => { if (this.rect && dpad.hasPointerCapture(e.pointerId)) this.padMove(e); });
    dpad.addEventListener('pointerup', () => this.padEnd());
    dpad.addEventListener('pointercancel', () => this.padEnd());
    bombBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); onBomb(); });
  }

  get dir() {
    if (this.padDir) return this.padDir;
    return this.held.length ? DIRS[this.held[this.held.length - 1]] : null;
  }

  padMove(e) {
    const rc = this.rect;
    const dx = e.clientX - rc.left - rc.width / 2, dy = e.clientY - rc.top - rc.height / 2;
    let d = null;
    if (Math.hypot(dx, dy) > DEAD_ZONE) d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : (dy > 0 ? DIRS.down : DIRS.up);
    if (d === this.padDir) return;
    this.padDir = d;
    const on = ARROW_CLASS.get(d);
    for (const a of this.arrows) a.classList.toggle('on', a.classList.contains(on));
  }

  padEnd() {
    this.padDir = null;
    this.rect = null;
    for (const a of this.arrows) a.classList.remove('on');
  }

  reset() {
    this.held = [];
    this.padEnd();
  }
}
