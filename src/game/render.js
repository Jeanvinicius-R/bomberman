// Desenho no canvas. Para rodar bem em celulares fracos:
// - o cenário (chão, paredes, blocos) fica pré-desenhado numa camada e só muda quando um bloco quebra;
// - personagens e itens são sprites gerados uma vez por tamanho de tela;
// - nada é alocado durante o quadro.
import { COLS, ROWS, TILE, WIDTH, HEIGHT, WALL, BLOCK, POWER, DIRS, DLIST } from '../config.js';
import { idx, levelHint } from './level.js';

const FONT = '"Press Start 2P", ui-monospace, monospace';
const SPRITE = 64; // tamanho do sprite em unidades do mundo (maior que o bloco para caber sombra e chapéu)
const HALF = SPRITE / 2;
const MAX_DPR = 2;

const POWER_STYLE = {
  [POWER.BOMB]: { bg: '#ff4d6d', fg: '#fff', label: 'B' },
  [POWER.RANGE]: { bg: '#ffb020', fg: '#1b1300', label: 'F' },
  [POWER.SPEED]: { bg: '#4cc3ff', fg: '#fff', label: 'V' },
  [POWER.LIFE]: { bg: '#5be37d', fg: '#1b1300', label: '+' },
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function makeSprite(scale, draw) {
  const c = makeCanvas(SPRITE * scale, SPRITE * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  g.translate(HALF, HALF);
  draw(g);
  return c;
}

/* ---------- desenhos base (coordenadas relativas ao centro do bloco) ---------- */

function paintPlayer(g, d) {
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, 18, 14, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4cc3ff'; g.fillRect(-12, 2, 24, 18);
  g.fillStyle = '#f4f0ff'; g.beginPath(); g.arc(0, -4, 15, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4cc3ff'; g.fillRect(-15, -20, 30, 9);
  g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(0, -22, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#15122b';
  g.fillRect(-7 + d.x * 4, -6 + d.y * 3, 4, 7); g.fillRect(3 + d.x * 4, -6 + d.y * 3, 4, 7);
}

function paintMonster(g, type, d) {
  const body = type === 'chaser' ? '#e0452e' : '#d6409f';
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, 17, 14, 5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = body; g.beginPath(); g.arc(0, -2, 16, Math.PI, 0); g.lineTo(16, 16);
  for (let i = 0; i < 4; i++) { g.lineTo(16 - (i + 0.5) * 8, i % 2 ? 16 : 10); g.lineTo(16 - (i + 1) * 8, 16); }
  g.fill();
  g.fillStyle = '#fff'; g.fillRect(-10, -8, 8, 9); g.fillRect(2, -8, 8, 9);
  g.fillStyle = '#15122b'; g.fillRect(-8 + d.x * 2, -5 + d.y * 2, 4, 5); g.fillRect(4 + d.x * 2, -5 + d.y * 2, 4, 5);
  if (type === 'chaser') {
    g.beginPath(); g.moveTo(-12, -13); g.lineTo(-1, -8); g.lineTo(-1, -11); g.fill();
    g.beginPath(); g.moveTo(12, -13); g.lineTo(1, -8); g.lineTo(1, -11); g.fill();
  }
}

function paintGhost(g, d) {
  g.globalAlpha = 0.85; g.fillStyle = '#bfe6ff';
  g.beginPath(); g.arc(0, -2, 17, Math.PI, 0); g.lineTo(17, 17);
  for (let i = 0; i < 4; i++) { g.lineTo(17 - (i + 0.5) * 8.5, i % 2 ? 17 : 11); g.lineTo(17 - (i + 1) * 8.5, 17); }
  g.fill(); g.globalAlpha = 1;
  g.fillStyle = '#15122b'; g.beginPath();
  g.arc(-6 + d.x * 2, -4 + d.y * 2, 4, 0, Math.PI * 2); g.arc(6 + d.x * 2, -4 + d.y * 2, 4, 0, Math.PI * 2); g.fill();
  g.fillRect(-4, 4, 8, 4);
}

function paintPower(g, k) {
  const s = POWER_STYLE[k];
  g.fillStyle = s.bg; g.fillRect(-16, -16, 32, 32);
  g.fillStyle = s.fg; g.font = `16px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(s.label, 1, 2);
}

function paintBomb(g) {
  g.fillStyle = '#111'; g.beginPath(); g.arc(0, 2, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4a4a66'; g.beginPath(); g.arc(-5, -3, 4, 0, Math.PI * 2); g.fill();
}

function paintFloor(g, c, r) {
  g.fillStyle = (r + c) % 2 ? '#3f8f4a' : '#3a8545';
  g.fillRect(c * TILE, r * TILE, TILE, TILE);
}

function paintWall(g, x, y) {
  g.fillStyle = '#7c849b'; g.fillRect(x, y, TILE, TILE);
  g.fillStyle = '#a7aec3'; g.fillRect(x, y, TILE, 5); g.fillRect(x, y, 5, TILE);
  g.fillStyle = '#586079'; g.fillRect(x, y + TILE - 6, TILE, 6); g.fillRect(x + TILE - 6, y, 6, TILE);
}

function paintBlock(g, x, y) {
  g.fillStyle = '#c8742f'; g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
  g.fillStyle = '#a45a20';
  g.fillRect(x + 2, y + TILE / 2 - 1, TILE - 4, 3); g.fillRect(x + TILE / 2 - 1, y + 2, 3, TILE / 2 - 3);
  g.fillRect(x + TILE / 4, y + TILE / 2 + 2, 3, TILE / 2 - 4); g.fillRect(x + 3 * TILE / 4, y + TILE / 2 + 2, 3, TILE / 2 - 4);
  g.fillStyle = '#e39a52'; g.fillRect(x + 2, y + 2, TILE - 4, 3);
}

const dirKey = (d) => (d === DIRS.up ? 0 : d === DIRS.down ? 1 : d === DIRS.left ? 2 : 3);

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bg = makeCanvas(1, 1);
    this.bgx = this.bg.getContext('2d');
    this.scale = 1;
    this.shake = 0;
    this.sprites = null;
  }

  // Ajusta o canvas ao espaço disponível, com resolução nítida limitada a 2x para poupar GPU.
  resize(availW, availH, game) {
    const fit = Math.min(availW / WIDTH, availH / HEIGHT);
    const cssW = Math.max(1, Math.floor(WIDTH * fit)), cssH = Math.max(1, Math.floor(HEIGHT * fit));
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.cv.style.width = cssW + 'px';
    this.cv.style.height = cssH + 'px';
    this.cv.width = Math.round(cssW * dpr);
    this.cv.height = Math.round(cssH * dpr);
    this.scale = this.cv.width / WIDTH;
    this.buildSprites();
    this.buildBackground(game);
  }

  buildSprites() {
    const s = this.scale;
    const perDir = (paint) => DLIST.map((d) => makeSprite(s, (g) => paint(g, d)));
    this.sprites = {
      player: perDir(paintPlayer),
      blob: perDir((g, d) => paintMonster(g, 'blob', d)),
      chaser: perDir((g, d) => paintMonster(g, 'chaser', d)),
      ghost: perDir(paintGhost),
      bomb: makeSprite(s, paintBomb),
      power: [null, POWER.BOMB, POWER.RANGE, POWER.SPEED, POWER.LIFE].map((k) => (k ? makeSprite(s, (g) => paintPower(g, k)) : null)),
    };
  }

  buildBackground(game) {
    this.bg.width = this.cv.width;
    this.bg.height = this.cv.height;
    const g = this.bgx;
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) this.paintTile(game, c, r);
  }

  paintTile(game, c, r) {
    const g = this.bgx, t = game.grid[idx(c, r)], x = c * TILE, y = r * TILE;
    paintFloor(g, c, r);
    if (t === WALL) paintWall(g, x, y);
    else if (t === BLOCK) paintBlock(g, x, y);
  }

  draw(game, now, dt) {
    const g = this.ctx, s = this.scale;
    let ox = 0, oy = 0;
    if (this.shake > 0) {
      this.shake -= dt;
      ox = (Math.random() - 0.5) * 6; oy = (Math.random() - 0.5) * 6;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.bg, ox * s, oy * s);
    g.setTransform(s, 0, 0, s, ox * s, oy * s);

    if (game.doorOpen) this.drawDoor(game, now);
    this.drawPowerups(game, now);
    this.drawFlames(game);
    this.drawBombs(game, now);

    const sp = this.sprites;
    for (const e of game.enemies) {
      const cx = (e.x + 0.5) * TILE, cy = (e.y + 0.5) * TILE + Math.sin(e.wob) * (e.type === 'ghost' ? 4 : 2);
      g.drawImage(sp[e.type][dirKey(e.dir)], cx - HALF, cy - HALF, SPRITE, SPRITE);
    }

    const p = game.player;
    if (game.state !== 'over' && !(p.inv > 0 && Math.floor(now / 90) % 2)) {
      g.drawImage(sp.player[dirKey(p.dir)], (p.x + 0.5) * TILE - HALF, (p.y + 0.5) * TILE - HALF, SPRITE, SPRITE);
    }

    for (let i = 0; i < game.particleCount; i++) {
      const q = game.particles[i];
      g.globalAlpha = Math.min(1, q.t * 2);
      g.fillStyle = q.color;
      g.fillRect(q.x - 3, q.y - 3, 6, 6);
    }
    g.globalAlpha = 1;

    g.setTransform(s, 0, 0, s, 0, 0);
    this.drawMessages(game);
  }

  drawDoor(game, now) {
    const g = this.ctx, x = game.door.c * TILE, y = game.door.r * TILE;
    g.fillStyle = '#1d1840'; g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    if (!game.enemies.length) {
      g.globalAlpha = 0.6 + Math.sin(now / 150) * 0.2;
      g.fillStyle = '#2ad4c4'; g.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
      g.globalAlpha = 1;
      g.fillStyle = '#c9fff9'; g.fillRect(x + 18, y + 14, 12, 20);
    } else {
      g.fillStyle = '#586079'; g.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
      g.fillStyle = '#a7aec3'; g.fillRect(x + 20, y + 22, 8, 10); g.fillRect(x + 22, y + 14, 4, 8);
    }
  }

  drawPowerups(game, now) {
    const g = this.ctx, power = game.power, bob = Math.sin(now / 200) * 2;
    for (let i = 0; i < power.length; i++) {
      if (!power[i]) continue;
      const c = i % COLS, r = (i - c) / COLS;
      g.drawImage(this.sprites.power[power[i]], (c + 0.5) * TILE - HALF, (r + 0.5) * TILE - HALF + bob, SPRITE, SPRITE);
    }
  }

  drawFlames(game) {
    const g = this.ctx, flames = game.flames;
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      if (f <= 0) continue;
      const c = i % COLS, r = (i - c) / COLS, x = c * TILE, y = r * TILE, a = Math.min(1, f / 0.3);
      g.globalAlpha = 0.9 * a; g.fillStyle = '#ff781e'; g.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      g.globalAlpha = a; g.fillStyle = '#ffe678'; g.fillRect(x + 12, y + 12, TILE - 24, TILE - 24);
    }
    g.globalAlpha = 1;
  }

  drawBombs(game, now) {
    const g = this.ctx, pulse = 1 + Math.sin(now / 90) * 0.08, size = SPRITE * pulse, half = size / 2;
    for (const b of game.bombs) {
      const cx = (b.c + 0.5) * TILE, cy = (b.r + 0.5) * TILE;
      g.drawImage(this.sprites.bomb, cx - half, cy - half, size, size);
      g.fillStyle = b.t < 0.8 && Math.floor(now / 80) % 2 ? '#ff4d6d' : '#ffb020';
      g.fillRect(cx + 5, cy - 20, 4, 7);
    }
  }

  drawMessages(game) {
    const g = this.ctx;
    if (game.state === 'intro') {
      g.fillStyle = 'rgba(21,18,43,.78)'; g.fillRect(0, 190, WIDTH, 150);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffb020'; g.font = `32px ${FONT}`; g.fillText('FASE ' + game.level, WIDTH / 2, 245);
      g.fillStyle = '#f4f0ff'; g.font = `12px ${FONT}`; g.fillText(levelHint(game.level), WIDTH / 2, 300);
    } else if (game.state === 'play' && !game.enemies.length) {
      g.fillStyle = 'rgba(21,18,43,.8)'; g.fillRect(0, 8, WIDTH, 30);
      g.fillStyle = '#5be37d'; g.font = `12px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(game.doorOpen ? 'A PORTA ABRIU! ENTRE NELA' : 'TODOS ELIMINADOS! ACHE A PORTA', WIDTH / 2, 24);
    }
  }
}
