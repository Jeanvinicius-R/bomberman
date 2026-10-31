// Lógica do jogo, sem DOM nem canvas. Comunica-se com o resto do app por eventos.
import { COLS, ROWS, TILE, EMPTY, WALL, BLOCK, POWER, DIRS, DLIST, RULES } from '../config.js';
import { generateLevel, idx } from './level.js';

const MAX_PARTICLES = 160;
const noop = () => {};

// Move uma entidade de célula em célula. `choose` decide a próxima direção ao chegar numa célula.
function stepEntity(e, dt, choose, can) {
  for (let guard = 0; dt > 0 && guard < 4; guard++) {
    if (!e.moving) {
      const d = choose(e);
      if (!d || !can(e.x + d.x, e.y + d.y)) return;
      e.fx = e.x; e.fy = e.y; e.tx = e.x + d.x; e.ty = e.y + d.y; e.moving = true; e.dir = d;
    } else if (e.reversible) {
      // O jogador pode dar meia-volta no meio do caminho, o que deixa o controle responsivo.
      const d = choose(e);
      if (d && d.x === -e.dir.x && d.y === -e.dir.y) {
        const ax = e.tx, ay = e.ty;
        e.tx = e.fx; e.ty = e.fy; e.fx = ax; e.fy = ay; e.dir = d;
      }
    }
    const dist = Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y);
    const mv = e.speed * dt;
    if (mv >= dist) {
      e.x = e.tx; e.y = e.ty; e.moving = false; dt -= dist / e.speed;
    } else {
      e.x += Math.sign(e.tx - e.x) * mv; e.y += Math.sign(e.ty - e.y) * mv; dt = 0;
    }
  }
}

function placeAt(e, c, r) {
  e.x = e.fx = e.tx = c;
  e.y = e.fy = e.ty = r;
  e.moving = false;
}

export class Game {
  constructor({ rng = Math.random, events = {} } = {}) {
    this.rng = rng;
    this.ev = {
      hud: noop, sfx: noop, haptic: noop, shake: noop, levelBuilt: noop, tileChanged: noop,
      clear: noop, over: noop, ...events,
    };
    this.state = 'menu'; // menu | intro | play | pause | clear | over
    this.level = 1;
    this.lives = RULES.startLives;
    this.score = 0;
    this.nextLife = RULES.extraLifeEvery;
    this.timeLeft = 0;
    this.introT = 0;
    this.wantDir = null;
    this.player = { reversible: true, dir: DIRS.down };
    this.grid = new Uint8Array(COLS * ROWS);
    this.power = new Uint8Array(COLS * ROWS);
    this.flames = new Float32Array(COLS * ROWS);
    this.bombs = [];
    this.enemies = [];
    this.door = { c: 0, r: 0 };
    this.particles = [];
    this.particleCount = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) this.particles.push({ x: 0, y: 0, vx: 0, vy: 0, t: 0, color: '' });

    this._choosePlayer = () => this.wantDir;
    this._chooseEnemy = (e) => this.enemyChoose(e);
    this._playerCan = (c, r) => this.playerCan(c, r);
    this._enemyCan = (c, r) => this.enemyCan(c, r);
    this._ghostCan = (c, r) => this.ghostCan(c, r);
    this._opts = [];
    this._side = [];

    this.resetStats();
  }

  /* ---------- ciclo de partida ---------- */

  resetStats() {
    const p = this.player, base = RULES.player;
    p.maxBombs = base.bombs; p.range = base.range; p.speed = base.speed;
  }

  newGame() {
    this.level = 1;
    this.lives = RULES.startLives;
    this.score = 0;
    this.nextLife = RULES.extraLifeEvery;
    this.resetStats();
    this.buildLevel();
    this.beginIntro();
  }

  nextLevel() {
    this.level++;
    this.buildLevel();
    this.beginIntro();
  }

  buildLevel() {
    const lvl = generateLevel(this.level, this.rng);
    this.grid.set(lvl.grid);
    this.power.fill(POWER.NONE);
    this.flames.fill(0);
    this.door = lvl.door;
    this.bombs.length = 0;
    this.particleCount = 0;
    this.enemies = lvl.enemies.map((e) => ({
      type: e.type, speed: e.speed, dir: e.dir,
      x: e.x, y: e.y, fx: e.x, fy: e.y, tx: e.x, ty: e.y, moving: false,
      wob: this.rng() * 6,
    }));
    const p = this.player;
    placeAt(p, 1, 1);
    p.dir = DIRS.down;
    p.inv = RULES.invulnerable;
    this.timeLeft = lvl.cfg.time;
    this.ev.levelBuilt();
    this.ev.hud();
  }

  beginIntro() {
    this.state = 'intro';
    this.introT = RULES.introTime;
    this.ev.hud();
  }

  pause() {
    if (this.state !== 'play' && this.state !== 'intro') return false;
    this.resumeTo = this.state;
    this.state = 'pause';
    return true;
  }

  resume() {
    if (this.state === 'pause') this.state = this.resumeTo || 'play';
  }

  get doorOpen() { return this.grid[idx(this.door.c, this.door.r)] === EMPTY; }

  /* ---------- regras de movimento ---------- */

  isWall(c, r) { return c < 0 || r < 0 || c >= COLS || r >= ROWS || this.grid[idx(c, r)] === WALL; }

  bombAt(c, r) {
    for (let i = 0; i < this.bombs.length; i++) {
      const b = this.bombs[i];
      if (b.c === c && b.r === r) return b;
    }
    return null;
  }

  playerCan(c, r) {
    if (this.isWall(c, r) || this.grid[idx(c, r)] === BLOCK) return false;
    const b = this.bombAt(c, r);
    return !(b && !b.pass);
  }

  enemyCan(c, r) { return !this.isWall(c, r) && this.grid[idx(c, r)] === EMPTY && !this.bombAt(c, r); }
  ghostCan(c, r) { return !this.isWall(c, r) && !this.bombAt(c, r); }

  enemyChoose(e) {
    const can = e.type === 'ghost' ? this._ghostCan : this._enemyCan;
    const opts = this._opts, side = this._side, rng = this.rng, p = this.player;
    opts.length = 0; side.length = 0;
    for (let i = 0; i < 4; i++) { const d = DLIST[i]; if (can(e.x + d.x, e.y + d.y)) opts.push(d); }
    if (!opts.length) return null;

    const dist = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
    const chase = e.type === 'chaser' ? (dist <= 9 ? 0.8 : 0) : e.type === 'ghost' ? (dist <= 7 ? 0.4 : 0) : 0;
    if (chase && rng() < chase) {
      let best = null, bd = Infinity;
      for (const d of opts) {
        const dd = Math.abs(p.x - (e.x + d.x)) + Math.abs(p.y - (e.y + d.y)) + rng() * 0.5;
        if (dd < bd) { bd = dd; best = d; }
      }
      return best;
    }

    let fwd = null;
    for (const d of opts) {
      if (d === e.dir) fwd = d;
      else if (!(d.x === -e.dir.x && d.y === -e.dir.y)) side.push(d);
    }
    const turn = e.type === 'ghost' ? 0.45 : 0.25;
    if (fwd && (!side.length || rng() > turn)) return fwd;
    if (side.length) return side[Math.floor(rng() * side.length)];
    return opts[Math.floor(rng() * opts.length)];
  }

  /* ---------- bombas ---------- */

  placeBomb() {
    if (this.state !== 'play') return false;
    const p = this.player, c = Math.round(p.x), r = Math.round(p.y);
    if (this.bombs.length >= p.maxBombs || this.bombAt(c, r)) return false;
    this.bombs.push({ c, r, t: RULES.bombFuse, range: p.range, pass: true });
    this.ev.sfx('bomb');
    return true;
  }

  explode(b) {
    const i = this.bombs.indexOf(b);
    if (i < 0) return;
    this.bombs.splice(i, 1);
    this.ev.sfx('boom');
    this.ev.shake(0.2);
    this.flames[idx(b.c, b.r)] = RULES.flameTime;

    for (const d of DLIST) {
      for (let k = 1; k <= b.range; k++) {
        const c = b.c + d.x * k, r = b.r + d.y * k, at = idx(c, r);
        if (this.grid[at] === WALL) break;
        if (this.grid[at] === BLOCK) {
          this.grid[at] = EMPTY;
          this.flames[at] = RULES.flameTime;
          this.addScore(RULES.score.block);
          this.burst(c, r, '#c8742f');
          this.ev.tileChanged(c, r);
          if (!(c === this.door.c && r === this.door.r) && this.rng() < RULES.dropChance) this.power[at] = this.rollPower();
          break;
        }
        this.flames[at] = RULES.flameTime;
        const other = this.bombAt(c, r);
        if (other) { this.explode(other); break; }
      }
    }
  }

  rollPower() {
    const roll = this.rng();
    return roll < 0.12 ? POWER.LIFE : roll < 0.45 ? POWER.BOMB : roll < 0.8 ? POWER.RANGE : POWER.SPEED;
  }

  burst(c, r, color) {
    for (let i = 0; i < 8 && this.particleCount < MAX_PARTICLES; i++) {
      const p = this.particles[this.particleCount++];
      p.x = (c + 0.5) * TILE; p.y = (r + 0.5) * TILE;
      p.vx = (this.rng() - 0.5) * 220; p.vy = (this.rng() - 0.5) * 220;
      p.t = 0.5; p.color = color;
    }
  }

  /* ---------- pontos e vidas ---------- */

  addScore(n) {
    this.score += n;
    while (this.score >= this.nextLife) {
      this.nextLife += RULES.extraLifeEvery;
      if (this.lives < RULES.maxLives) this.lives++;
      this.ev.sfx('life');
    }
    this.ev.hud();
  }

  hurtPlayer() {
    const p = this.player;
    if (p.inv > 0) return;
    this.lives--;
    this.ev.sfx('hurt');
    this.ev.haptic('heavy');
    this.burst(Math.round(p.x), Math.round(p.y), '#fff');
    this.ev.hud();
    if (this.lives <= 0) {
      this.state = 'over';
      this.ev.over({ score: this.score, level: this.level });
      return;
    }
    placeAt(p, 1, 1);
    p.inv = RULES.invulnerable;
  }

  pickUp(at) {
    const k = this.power[at], p = this.player, base = RULES.player;
    this.power[at] = POWER.NONE;
    if (k === POWER.BOMB) p.maxBombs = Math.min(p.maxBombs + 1, base.maxBombs);
    else if (k === POWER.RANGE) p.range = Math.min(p.range + 1, base.maxRange);
    else if (k === POWER.SPEED) p.speed = Math.min(p.speed + base.speedStep, base.maxSpeed);
    else if (k === POWER.LIFE) this.lives = Math.min(this.lives + 1, RULES.maxLives);
    this.ev.sfx('pickup');
    this.ev.haptic('light');
    this.addScore(RULES.score.powerup);
  }

  levelDone() {
    this.state = 'clear';
    const bonus = 500 + this.level * 100 + Math.floor(this.timeLeft) * 5;
    this.addScore(bonus);
    this.ev.sfx('clear');
    this.ev.clear({ level: this.level, bonus, score: this.score });
  }

  /* ---------- atualização por quadro ---------- */

  update(dt) {
    this.updateParticles(dt);
    if (this.state === 'intro') {
      this.introT -= dt;
      if (this.introT <= 0) this.state = 'play';
      return;
    }
    if (this.state !== 'play') return;

    const p = this.player;
    if (p.inv > 0) p.inv -= dt;

    const prevSec = Math.ceil(this.timeLeft);
    this.timeLeft -= dt;
    if (Math.ceil(this.timeLeft) !== prevSec) this.ev.hud();
    if (this.timeLeft <= 0) {
      this.timeLeft = RULES.overtime;
      p.inv = 0;
      this.hurtPlayer();
      if (this.state !== 'play') return;
    }

    stepEntity(p, dt, this._choosePlayer, this._playerCan);
    const pc = Math.round(p.x), pr = Math.round(p.y), pAt = idx(pc, pr);

    for (const b of this.bombs) {
      if (b.pass && (b.c !== pc || b.r !== pr)) b.pass = false;
      b.t -= dt;
    }
    // Explosões em cadeia alteram a lista, então procura de novo a cada explosão.
    for (let b = this.nextFused(); b; b = this.nextFused()) this.explode(b);

    const flames = this.flames;
    for (let i = 0; i < flames.length; i++) if (flames[i] > 0) flames[i] -= dt;

    if (this.power[pAt]) this.pickUp(pAt);

    for (let j = this.enemies.length - 1; j >= 0; j--) {
      const e = this.enemies[j];
      e.wob += dt * 8;
      stepEntity(e, dt, this._chooseEnemy, e.type === 'ghost' ? this._ghostCan : this._enemyCan);
      const ec = Math.round(e.x), er = Math.round(e.y);
      if (flames[idx(ec, er)] > 0) {
        this.enemies.splice(j, 1);
        this.addScore(RULES.score[e.type]);
        this.burst(ec, er, '#ff7ab8');
        this.ev.sfx('kill');
        continue;
      }
      if (Math.hypot(e.x - p.x, e.y - p.y) < 0.6) {
        this.hurtPlayer();
        if (this.state !== 'play') return;
      }
    }

    if (flames[pAt] > 0) {
      this.hurtPlayer();
      if (this.state !== 'play') return;
    }

    if (!this.enemies.length && this.doorOpen && pc === this.door.c && pr === this.door.r) this.levelDone();
  }

  nextFused() {
    for (const b of this.bombs) if (b.t <= 0) return b;
    return null;
  }

  updateParticles(dt) {
    const ps = this.particles;
    let n = 0;
    for (let i = 0; i < this.particleCount; i++) {
      const p = ps[i];
      p.t -= dt;
      if (p.t <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (i !== n) { ps[i] = ps[n]; ps[n] = p; }
      n++;
    }
    this.particleCount = n;
  }
}
