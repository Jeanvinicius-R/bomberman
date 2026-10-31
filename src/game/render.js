// Desenho no canvas. Para rodar bem em celulares fracos:
// - o cenário (chão, paredes, blocos, sombras) fica pré-desenhado numa camada e só muda quando um bloco quebra;
// - personagens, bombas, chamas e itens são sprites gerados uma vez por tamanho de tela;
// - nada é alocado durante o quadro.
import { COLS, ROWS, TILE, WIDTH, HEIGHT, WALL, BLOCK, POWER, DIRS, DLIST } from '../config.js';
import { idx, levelHint } from './level.js';

const FONT = '"Press Start 2P", ui-monospace, monospace';
const SPRITE = 64; // tamanho do sprite em unidades do mundo (maior que o bloco para caber sombra e capacete)
const HALF = SPRITE / 2;
const MAX_DPR = 2;
const TAU = Math.PI * 2;

const POWER_STYLE = {
  [POWER.BOMB]: { top: '#ff8aa0', bg: '#e0264a', fg: '#fff', label: 'B' },
  [POWER.RANGE]: { top: '#ffd36e', bg: '#e58a00', fg: '#2a1700', label: 'F' },
  [POWER.SPEED]: { top: '#9be0ff', bg: '#1a8fd6', fg: '#fff', label: 'V' },
  [POWER.LIFE]: { top: '#9bf2b0', bg: '#1fb24a', fg: '#06210f', label: '+' },
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

/* ---------- utilitários de desenho ---------- */

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function circle(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
}

function vgrad(g, y0, y1, top, bottom) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bottom);
  return gr;
}

function groundShadow(g, rx, ry, y) {
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath();
  g.ellipse(0, y, rx, ry, 0, 0, TAU);
  g.fill();
}

// Número pseudoaleatório estável por casa: o cenário não "pisca" quando é redesenhado.
function hash(c, r, k) {
  let h = (Math.imul(c, 374761393) + Math.imul(r, 668265263) + Math.imul(k, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ---------- personagens (coordenadas relativas ao centro do bloco) ---------- */

function paintPlayer(g, d) {
  const up = d.y < 0, dx = d.x, dy = Math.max(d.y, 0);
  groundShadow(g, 15, 6, 20);
  // botas
  g.fillStyle = '#2a2150';
  rr(g, -11, 15, 9, 6, 2.5); g.fill();
  rr(g, 2, 15, 9, 6, 2.5); g.fill();
  // macacão
  g.fillStyle = vgrad(g, 2, 18, '#52a8ff', '#2862c2');
  rr(g, -11, 2, 22, 15, 5); g.fill();
  g.fillStyle = '#ffb020'; g.fillRect(-11, 10, 22, 3);
  g.fillStyle = '#fff3c4'; g.fillRect(-2.5, 9.5, 5, 4);
  // luvas
  g.fillStyle = '#f4f0ff';
  circle(g, -13.5, 10, 4); g.fill();
  circle(g, 13.5, 10, 4); g.fill();
  // cabeça
  const sk = g.createRadialGradient(-4, -9, 2, 0, -5, 15);
  sk.addColorStop(0, '#ffe9d0'); sk.addColorStop(1, '#eeb283');
  g.fillStyle = sk;
  circle(g, 0, -4, 13); g.fill();
  if (up) {
    g.fillStyle = '#7a4b2a';
    g.beginPath(); g.arc(0, -4, 13, 0.15 * Math.PI, 0.85 * Math.PI); g.fill();
  } else {
    // óculos e sorriso
    g.fillStyle = '#2b2b3f';
    rr(g, -13 + dx * 2, -4 + dy * 2, 26, 8, 4); g.fill();
    g.fillStyle = '#eaffff';
    circle(g, -5.5 + dx * 3, 0 + dy * 2, 4.2); g.fill();
    circle(g, 5.5 + dx * 3, 0 + dy * 2, 4.2); g.fill();
    g.fillStyle = '#15122b';
    circle(g, -5.5 + dx * 4.5, 0.5 + dy * 3, 2); g.fill();
    circle(g, 5.5 + dx * 4.5, 0.5 + dy * 3, 2); g.fill();
    g.fillStyle = '#9b4a2a'; g.fillRect(-3 + dx * 3, 6 + dy, 6, 2);
  }
  // capacete com lanterna
  g.fillStyle = (() => { const h = g.createLinearGradient(-15, -24, 15, -8); h.addColorStop(0, '#ffc15e'); h.addColorStop(1, '#ff7a12'); return h; })();
  g.beginPath(); g.arc(0, -8, 15, Math.PI, 0); g.closePath(); g.fill();
  g.fillStyle = '#d9610a'; rr(g, -17, -9, 34, 5, 2.5); g.fill();
  g.fillStyle = 'rgba(255,255,255,.5)'; rr(g, -10, -20, 9, 3, 1.5); g.fill();
  if (!up) {
    g.fillStyle = '#c58a00'; circle(g, dx * 3, -15, 4); g.fill();
    g.fillStyle = '#fff6b0'; circle(g, dx * 3, -15, 2.8); g.fill();
  }
}

const MONSTER = {
  blob: { top: '#ff86d0', bottom: '#c0288c', line: '#5e0a45' },
  chaser: { top: '#ff8a66', bottom: '#c3261a', line: '#5a0b05' },
};

function paintMonster(g, type, d) {
  const m = MONSTER[type];
  groundShadow(g, 15, 5, 19);
  g.fillStyle = m.line;
  g.beginPath(); g.ellipse(-8, 17, 6, 3.5, 0, 0, TAU); g.ellipse(8, 17, 6, 3.5, 0, 0, TAU); g.fill();
  if (type === 'chaser') {
    g.fillStyle = m.line;
    g.beginPath(); g.moveTo(-14, -12); g.lineTo(-10, -26); g.lineTo(-4, -15); g.fill();
    g.beginPath(); g.moveTo(14, -12); g.lineTo(10, -26); g.lineTo(4, -15); g.fill();
  }
  g.beginPath();
  g.moveTo(-17, 14);
  g.bezierCurveTo(-21, -24, 21, -24, 17, 14);
  g.quadraticCurveTo(0, 21, -17, 14);
  g.closePath();
  g.fillStyle = vgrad(g, -18, 18, m.top, m.bottom);
  g.fill();
  g.lineWidth = 2; g.strokeStyle = m.line; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.38)';
  g.beginPath(); g.ellipse(-8, -11, 5, 2.8, -0.5, 0, TAU); g.fill();
  // olhos
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(-6, -3, 5.5, 6.5, 0, 0, TAU); g.ellipse(6, -3, 5.5, 6.5, 0, 0, TAU); g.fill();
  g.fillStyle = '#15122b';
  circle(g, -6 + d.x * 2.5, -3 + d.y * 2.5, 3); g.fill();
  circle(g, 6 + d.x * 2.5, -3 + d.y * 2.5, 3); g.fill();
  g.fillStyle = '#fff';
  circle(g, -7 + d.x * 2.5, -4.5 + d.y * 2.5, 1); g.fill();
  circle(g, 5 + d.x * 2.5, -4.5 + d.y * 2.5, 1); g.fill();
  if (type === 'chaser') {
    g.strokeStyle = m.line; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-12, -11); g.lineTo(-2, -7); g.moveTo(12, -11); g.lineTo(2, -7); g.stroke();
    g.fillStyle = '#3a0a06'; rr(g, -7, 6, 14, 6, 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(-6, 6); g.lineTo(-3, 6); g.lineTo(-4.5, 10); g.fill();
    g.beginPath(); g.moveTo(6, 6); g.lineTo(3, 6); g.lineTo(4.5, 10); g.fill();
  } else {
    g.strokeStyle = m.line; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 5, 4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
}

function paintGhost(g, d) {
  groundShadow(g, 12, 4, 21);
  g.save();
  g.shadowColor = 'rgba(150,225,255,.95)'; g.shadowBlur = 9;
  g.fillStyle = vgrad(g, -19, 20, '#f2fbff', '#9fd0ff');
  g.beginPath();
  g.arc(0, -2, 17, Math.PI, 0);
  g.lineTo(17, 16);
  for (let i = 0; i < 4; i++) g.quadraticCurveTo(17 - (i + 0.5) * 8.5, i % 2 ? 11 : 22, 17 - (i + 1) * 8.5, 16);
  g.closePath(); g.fill();
  g.restore();
  g.fillStyle = 'rgba(190,230,255,.9)';
  g.beginPath(); g.ellipse(-19, 5, 4, 6, 0.3, 0, TAU); g.ellipse(19, 5, 4, 6, -0.3, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,140,180,.55)';
  circle(g, -11, 3, 3); g.fill(); circle(g, 11, 3, 3); g.fill();
  g.fillStyle = '#15122b';
  g.beginPath(); g.ellipse(-6 + d.x * 2, -4 + d.y * 2, 3.6, 5, 0, 0, TAU); g.ellipse(6 + d.x * 2, -4 + d.y * 2, 3.6, 5, 0, 0, TAU); g.fill();
  g.fillStyle = '#fff';
  circle(g, -7 + d.x * 2, -6 + d.y * 2, 1.2); g.fill(); circle(g, 5 + d.x * 2, -6 + d.y * 2, 1.2); g.fill();
  g.fillStyle = '#3b3a6b'; g.beginPath(); g.ellipse(d.x * 2, 7 + d.y, 3, 3.6, 0, 0, TAU); g.fill();
}

/* ---------- objetos ---------- */

function paintBomb(g) {
  groundShadow(g, 15, 5, 18);
  const sp = g.createRadialGradient(-6, -4, 2, 0, 2, 19);
  sp.addColorStop(0, '#7a7aa8'); sp.addColorStop(0.45, '#25243f'); sp.addColorStop(1, '#0a0918');
  g.fillStyle = sp; circle(g, 0, 2, 16.5); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-6.5, -4, 3.4, 2.2, -0.6, 0, TAU); g.fill();
  g.fillStyle = vgrad(g, -17, -10, '#b4bad2', '#6b718c'); rr(g, -5.5, -17, 11, 7, 2); g.fill();
  g.strokeStyle = '#c8742f'; g.lineWidth = 2.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, -17); g.quadraticCurveTo(2, -23, 8, -24); g.stroke();
}

function paintFlame(g) {
  const glow = g.createRadialGradient(0, 0, 4, 0, 0, 30);
  glow.addColorStop(0, 'rgba(255,220,90,.85)'); glow.addColorStop(0.55, 'rgba(255,100,20,.55)'); glow.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = glow; circle(g, 0, 0, 30); g.fill();
  g.fillStyle = '#ff7a1a'; rr(g, -19, -19, 38, 38, 11); g.fill();
  g.fillStyle = '#ffc13a'; rr(g, -13, -13, 26, 26, 8); g.fill();
  g.fillStyle = '#fff4c0'; rr(g, -7, -7, 14, 14, 5); g.fill();
  g.fillStyle = '#ffe27a';
  g.fillRect(-23, -4, 4, 4); g.fillRect(19, 3, 4, 4); g.fillRect(-3, -24, 4, 4); g.fillRect(4, 20, 4, 4);
}

function paintPower(g, k) {
  const s = POWER_STYLE[k];
  g.save();
  g.shadowColor = s.bg; g.shadowBlur = 9;
  g.fillStyle = vgrad(g, -15, 15, s.top, s.bg);
  rr(g, -15, -15, 30, 30, 8); g.fill();
  g.restore();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.9)'; rr(g, -15, -15, 30, 30, 8); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.28)'; rr(g, -12, -12, 24, 10, 5); g.fill();
  g.font = `16px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillText(s.label, 1.5, 3.5);
  g.fillStyle = s.fg; g.fillText(s.label, 0.5, 2.5);
}

function paintDoor(g, open) {
  g.fillStyle = '#4a5168'; rr(g, -21, -22, 42, 44, 10); g.fill();
  g.fillStyle = '#7c849b'; rr(g, -19, -20, 38, 40, 9); g.fill();
  if (open) {
    const gl = g.createRadialGradient(0, 2, 2, 0, 2, 19);
    gl.addColorStop(0, '#eafffd'); gl.addColorStop(0.5, '#2ad4c4'); gl.addColorStop(1, '#0a6e76');
    g.fillStyle = gl; rr(g, -14, -16, 28, 34, 12); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 2, 7, 0, TAU * 0.7); g.stroke();
  } else {
    g.fillStyle = '#1d1840'; rr(g, -14, -16, 28, 34, 12); g.fill();
    g.fillStyle = '#ffb020'; rr(g, -7, 0, 14, 11, 3); g.fill();
    g.strokeStyle = '#ffb020'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 5, Math.PI, 0); g.stroke();
    g.fillStyle = '#5a3a00'; g.fillRect(-1.5, 3.5, 3, 4);
  }
}

/* ---------- cenário (coordenadas em pixels do tabuleiro) ---------- */

const solid = (game, c, r) => c < 0 || r < 0 || c >= COLS || r >= ROWS || game.grid[idx(c, r)] !== 0;

function paintFloor(g, c, r) {
  const x = c * TILE, y = r * TILE;
  g.fillStyle = (r + c) % 2 ? '#43a052' : '#3c9649';
  g.fillRect(x, y, TILE, TILE);
  for (let k = 0; k < 4; k++) {
    if (hash(c, r, k) > 0.6) continue;
    g.fillStyle = k % 2 ? '#52b562' : '#318340';
    g.fillRect(x + 3 + Math.floor(hash(c, r, k + 10) * (TILE - 8)), y + 3 + Math.floor(hash(c, r, k + 20) * (TILE - 8)), 3, 2);
  }
  if (hash(c, r, 30) < 0.22) {
    const tx = x + 8 + Math.floor(hash(c, r, 31) * (TILE - 20)), ty = y + 12 + Math.floor(hash(c, r, 32) * (TILE - 24));
    g.fillStyle = '#2c7438';
    g.fillRect(tx, ty + 2, 2, 5); g.fillRect(tx + 3, ty, 2, 7); g.fillRect(tx + 6, ty + 2, 2, 5);
    g.fillStyle = '#5cc86e'; g.fillRect(tx + 3, ty, 2, 2);
  }
  if (hash(c, r, 40) < 0.07) {
    const fx = x + 10 + Math.floor(hash(c, r, 41) * (TILE - 24)), fy = y + 10 + Math.floor(hash(c, r, 42) * (TILE - 24));
    g.fillStyle = hash(c, r, 43) < 0.5 ? '#ffffff' : '#ffe27a';
    g.fillRect(fx, fy - 2, 2, 2); g.fillRect(fx - 2, fy, 2, 2); g.fillRect(fx + 2, fy, 2, 2); g.fillRect(fx, fy + 2, 2, 2);
    g.fillStyle = '#ff6b8b'; g.fillRect(fx, fy, 2, 2);
  }
}

// Sombra projetada por paredes e blocos nas casas livres vizinhas (luz vindo de cima à esquerda).
function paintShade(g, game, c, r) {
  const x = c * TILE, y = r * TILE;
  if (solid(game, c, r - 1)) {
    const gr = g.createLinearGradient(0, y, 0, y + 14);
    gr.addColorStop(0, 'rgba(10,30,20,.36)'); gr.addColorStop(1, 'rgba(10,30,20,0)');
    g.fillStyle = gr; g.fillRect(x, y, TILE, 14);
  }
  if (solid(game, c - 1, r)) {
    const gr = g.createLinearGradient(x, 0, x + 9, 0);
    gr.addColorStop(0, 'rgba(10,30,20,.26)'); gr.addColorStop(1, 'rgba(10,30,20,0)');
    g.fillStyle = gr; g.fillRect(x, y, 9, TILE);
  }
}

function paintWall(g, x, y) {
  g.fillStyle = '#7b8399'; g.fillRect(x, y, TILE, TILE);
  for (let i = 0; i < 4; i++) {
    const by = y + i * 12, off = (i % 2) * 12;
    g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x, by, TILE, 4);
    g.fillStyle = '#5f6780'; g.fillRect(x, by + 10, TILE, 2);
    for (let j = 0; j < 3; j++) g.fillRect(x + ((off + j * 24) % TILE), by, 2, 10);
  }
  g.fillStyle = '#c3cadf'; g.fillRect(x, y, TILE, 3); g.fillRect(x, y, 3, TILE);
  g.fillStyle = '#9aa2bb'; g.fillRect(x + 3, y + 3, TILE - 6, 2);
  g.fillStyle = '#454c63'; g.fillRect(x, y + TILE - 4, TILE, 4); g.fillRect(x + TILE - 4, y, 4, TILE);
}

function paintBlock(g, x, y) {
  g.fillStyle = 'rgba(0,0,0,.25)'; rr(g, x + 3, y + 5, TILE - 4, TILE - 4, 5); g.fill();
  g.fillStyle = '#8a4a17'; rr(g, x + 1, y + 1, TILE - 3, TILE - 4, 5); g.fill();
  const planks = ['#d08a42', '#c27632', '#d08a42'];
  for (let i = 0; i < 3; i++) {
    g.fillStyle = planks[i];
    g.fillRect(x + 5 + i * 13, y + 5, 12, TILE - 12);
  }
  g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x + 5, y + 5, TILE - 12, 2);
  g.strokeStyle = '#8a4a17'; g.lineWidth = 4; g.lineCap = 'butt';
  g.beginPath(); g.moveTo(x + 7, y + 7); g.lineTo(x + TILE - 9, y + TILE - 10); g.stroke();
  g.strokeStyle = '#e3a15a'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(x + 7, y + 5.5); g.lineTo(x + TILE - 9, y + TILE - 11.5); g.stroke();
  g.fillStyle = '#e8e2d2';
  for (const [nx, ny] of [[8, 8], [TILE - 11, 8], [8, TILE - 13], [TILE - 11, TILE - 13]]) { circle(g, x + nx, y + ny, 1.9); g.fill(); }
}

const dirKey = (d) => (d === DIRS.up ? 0 : d === DIRS.down ? 1 : d === DIRS.left ? 2 : 3);

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bg = makeCanvas(1, 1);
    this.bgx = this.bg.getContext('2d');
    this.vig = makeCanvas(1, 1);
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
    this.buildVignette();
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
      flame: makeSprite(s, paintFlame),
      doorClosed: makeSprite(s, (g) => paintDoor(g, false)),
      doorOpen: makeSprite(s, (g) => paintDoor(g, true)),
      power: [null, POWER.BOMB, POWER.RANGE, POWER.SPEED, POWER.LIFE].map((k) => (k ? makeSprite(s, (g) => paintPower(g, k)) : null)),
    };
  }

  buildBackground(game) {
    this.bg.width = this.cv.width;
    this.bg.height = this.cv.height;
    this.bgx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) this.paintCell(game, c, r);
  }

  // Escurece levemente as bordas para dar profundidade à arena.
  buildVignette() {
    const w = this.cv.width, h = this.cv.height;
    this.vig.width = w;
    this.vig.height = h;
    const g = this.vig.getContext('2d');
    const gr = g.createRadialGradient(w / 2, h / 2, h * 0.38, w / 2, h / 2, Math.max(w, h) * 0.72);
    gr.addColorStop(0, 'rgba(10,5,30,0)');
    gr.addColorStop(1, 'rgba(10,5,30,.42)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }

  paintCell(game, c, r) {
    const g = this.bgx, t = game.grid[idx(c, r)], x = c * TILE, y = r * TILE;
    paintFloor(g, c, r);
    if (t === WALL) paintWall(g, x, y);
    else if (t === BLOCK) paintBlock(g, x, y);
    else paintShade(g, game, c, r);
  }

  // Quando um bloco some, as casas vizinhas mudam de sombra, então repinta a vizinhança.
  paintTile(game, c, r) {
    for (let rr2 = Math.max(0, r - 1); rr2 <= Math.min(ROWS - 1, r + 1); rr2++) {
      for (let cc = Math.max(0, c - 1); cc <= Math.min(COLS - 1, c + 1); cc++) this.paintCell(game, cc, rr2);
    }
  }

  draw(game, now, dt) {
    const g = this.ctx, s = this.scale, sp = this.sprites;
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

    for (const e of game.enemies) {
      const cx = (e.x + 0.5) * TILE, ghost = e.type === 'ghost';
      const cy = (e.y + 0.5) * TILE + Math.sin(e.wob) * (ghost ? 4 : 0);
      const sq = ghost ? 0 : Math.sin(e.wob * 1.3) * 0.06; // gosma "respira": estica e achata
      const w = SPRITE * (1 - sq), h = SPRITE * (1 + sq);
      g.drawImage(sp[e.type][dirKey(e.dir)], cx - w / 2, cy + 19 - (HALF + 19) * (h / SPRITE), w, h);
    }

    const p = game.player;
    if (game.state !== 'over' && !(p.inv > 0 && Math.floor(now / 90) % 2)) {
      const bob = p.moving ? -Math.abs(Math.sin(now / 70)) * 3 : 0;
      g.drawImage(sp.player[dirKey(p.dir)], (p.x + 0.5) * TILE - HALF, (p.y + 0.5) * TILE - HALF + bob, SPRITE, SPRITE);
    }

    for (let i = 0; i < game.particleCount; i++) {
      const q = game.particles[i];
      g.globalAlpha = Math.min(1, q.t * 2);
      g.fillStyle = q.color;
      g.fillRect(q.x - 3, q.y - 3, 6, 6);
    }
    g.globalAlpha = 1;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.vig, 0, 0);
    g.setTransform(s, 0, 0, s, 0, 0);
    this.drawMessages(game);
  }

  drawDoor(game, now) {
    const g = this.ctx, cx = (game.door.c + 0.5) * TILE, cy = (game.door.r + 0.5) * TILE;
    if (game.enemies.length) {
      g.drawImage(this.sprites.doorClosed, cx - HALF, cy - HALF, SPRITE, SPRITE);
      return;
    }
    const k = 1 + Math.sin(now / 160) * 0.05;
    g.drawImage(this.sprites.doorOpen, cx - HALF * k, cy - HALF * k, SPRITE * k, SPRITE * k);
  }

  drawPowerups(game, now) {
    const g = this.ctx, power = game.power, bob = Math.sin(now / 200) * 2.5;
    for (let i = 0; i < power.length; i++) {
      if (!power[i]) continue;
      const c = i % COLS, r = (i - c) / COLS;
      g.drawImage(this.sprites.power[power[i]], (c + 0.5) * TILE - HALF, (r + 0.5) * TILE - HALF + bob, SPRITE, SPRITE);
    }
  }

  drawFlames(game) {
    const g = this.ctx, flames = game.flames, img = this.sprites.flame;
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      if (f <= 0) continue;
      const c = i % COLS, r = (i - c) / COLS;
      const a = Math.min(1, f / 0.3), k = 0.75 + 0.25 * a, size = SPRITE * k;
      g.globalAlpha = a;
      g.drawImage(img, (c + 0.5) * TILE - size / 2, (r + 0.5) * TILE - size / 2, size, size);
    }
    g.globalAlpha = 1;
  }

  drawBombs(game, now) {
    const g = this.ctx, pulse = 1 + Math.sin(now / 90) * 0.07, size = SPRITE * pulse;
    for (const b of game.bombs) {
      const cx = (b.c + 0.5) * TILE, cy = (b.r + 0.5) * TILE;
      g.drawImage(this.sprites.bomb, cx - size / 2, cy - size / 2 + (SPRITE - size) / 2, size, size);
      // faísca do pavio; pisca mais rápido perto de explodir
      const hot = b.t < 0.8, flick = Math.floor(now / (hot ? 60 : 110)) % 2;
      g.fillStyle = hot && flick ? '#ff4d6d' : '#ffb020';
      circle(g, cx + 8, cy - 24, flick ? 4 : 3); g.fill();
      g.fillStyle = '#fff4c8';
      circle(g, cx + 8, cy - 24, 1.6); g.fill();
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
