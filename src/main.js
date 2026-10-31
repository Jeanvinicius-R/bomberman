// Ponto de entrada: liga jogo, desenho, telas, som e integração com o Android.
import '@fontsource/press-start-2p/400.css';
import './styles.css';
import { Game } from './game/game.js';
import { Renderer } from './game/render.js';
import { RULES } from './config.js';
import { Sound } from './services/audio.js';
import { createStorage } from './services/storage.js';
import { normalizeName, isValidName } from './services/names.js';
import { setupPlatform, exitApp, haptic } from './services/platform.js';
import { Input } from './ui/input.js';

const $ = (id) => document.getElementById(id);

const storage = createStorage();
const profile = storage.loadProfile();
const sound = new Sound();
sound.enabled = profile.sound;

const overlay = $('overlay'), arena = $('arena');
const panels = [...overlay.querySelectorAll('.panel')];
let screen = 'menu';
let needsDraw = true;
let hudDirty = true;

const renderer = new Renderer($('cv'));
const game = new Game({
  events: {
    hud: () => { hudDirty = true; },
    sfx: (name) => sound.play(name),
    haptic: (kind) => { if (profile.sound) haptic(kind); },
    shake: (t) => { renderer.shake = t; },
    levelBuilt: () => { renderer.buildBackground(game); needsDraw = true; },
    tileChanged: (c, r) => renderer.paintTile(game, c, r),
    clear: onLevelClear,
    over: onGameOver,
  },
});

/* ---------- HUD ---------- */

const hud = { level: $('hLevel'), lives: $('hLives'), time: $('hTime'), score: $('hScore'), pow: $('hPow') };
const hudLast = {};
function setText(key, value) {
  if (hudLast[key] === value) return;
  hudLast[key] = value;
  hud[key].textContent = value;
}
const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function updateHud() {
  hudDirty = false;
  setText('level', String(game.level));
  setText('lives', String(game.lives));
  setText('score', String(game.score));
  setText('pow', game.player.maxBombs + '/' + game.player.range);
  setText('time', fmtTime(game.timeLeft));
  hud.time.classList.toggle('low', game.state === 'play' && game.timeLeft <= RULES.lowTime);
}

/* ---------- telas ---------- */

function show(name) {
  screen = name;
  for (const p of panels) p.hidden = p.dataset.p !== name;
  overlay.hidden = false;
  overlay.scrollTop = 0;
  const focusable = overlay.querySelector(`[data-p="${name}"] .btn`);
  if (focusable && matchMedia('(hover: hover)').matches) focusable.focus({ preventScroll: true });
}

function hideOverlay() {
  screen = null;
  overlay.hidden = true;
}

function showMenu() {
  input.reset();
  if (game.state !== 'menu') { game.state = 'menu'; needsDraw = true; }
  $('who').textContent = profile.name || '-';
  $('bestLine').textContent = profile.best ? `Seu recorde: ${profile.best} pontos` : '';
  $('soundBtn').textContent = 'SOM: ' + (profile.sound ? 'LIGADO' : 'DESLIGADO');
  show('menu');
}

function fillTable(tbody, rows, highlight) {
  tbody.textContent = '';
  if (!rows.length) {
    const tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = 'Ninguém no ranking ainda. Seja o primeiro!';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (highlight(r, i)) tr.className = 'me';
    for (const v of [i + 1, r.name, r.level, r.score]) {
      const td = document.createElement('td');
      td.textContent = String(v);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
}

let nameNext = null, howNext = null;

function askName(next) {
  nameNext = next;
  $('nick').value = profile.name;
  $('nameErr').textContent = '';
  show('name');
  setTimeout(() => $('nick').focus(), 50);
}

function startRun() {
  hideOverlay();
  game.newGame();
}

function onPlay() {
  sound.unlock();
  if (!profile.name) return askName(onPlay);
  if (!profile.seen) {
    profile.seen = true;
    storage.saveProfile(profile);
    howNext = startRun;
    return show('howto');
  }
  startRun();
}

function pauseGame() {
  if (!game.pause()) return;
  input.reset();
  show('pause');
}

function resumeGame() {
  hideOverlay();
  game.resume();
}

function onLevelClear({ level, bonus, score }) {
  $('clearTitle').textContent = `FASE ${level} COMPLETA`;
  $('clearText').textContent = `Bônus de ${bonus} pontos pelo tempo e pela fase. Pontuação: ${score}.`;
  show('clear');
}

function onGameOver({ score, level }) {
  const isBest = score > profile.best;
  if (isBest) { profile.best = score; storage.saveProfile(profile); }
  const { rows, pos } = storage.addToRanking({ name: profile.name, score, level, ts: Date.now() });
  $('overScore').textContent = String(score);
  $('overText').textContent = (isBest ? 'Novo recorde! ' : '') + `Você chegou à fase ${level}.`;
  fillTable($('overBody'), rows, (_, i) => i === pos);
  show('over');
}

$('titleScreen').addEventListener('click', () => { sound.unlock(); sound.play('ui'); showMenu(); });
$('titleScreen').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('titleScreen').click(); } });
$('playBtn').addEventListener('click', onPlay);
$('howBtn').addEventListener('click', () => { sound.unlock(); howNext = showMenu; show('howto'); });
$('howOk').addEventListener('click', () => { const f = howNext || showMenu; howNext = null; f(); });
$('rankBtn').addEventListener('click', () => {
  sound.unlock();
  fillTable($('rankBody'), storage.loadRanking(), (r) => r.name === profile.name);
  show('rank');
});
$('rankBack').addEventListener('click', showMenu);
$('soundBtn').addEventListener('click', () => {
  sound.unlock();
  profile.sound = sound.enabled = !profile.sound;
  storage.saveProfile(profile);
  showMenu();
  sound.play('ui');
});
$('renameBtn').addEventListener('click', () => askName(showMenu));
$('nameCancel').addEventListener('click', () => { nameNext = null; showMenu(); });
$('nameForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const v = normalizeName($('nick').value);
  if (!isValidName(v)) { $('nameErr').textContent = 'Use de 2 a 12 letras, números, espaço, _ ou -.'; return; }
  profile.name = v;
  storage.saveProfile(profile);
  $('nick').blur();
  const f = nameNext || showMenu;
  nameNext = null;
  f();
});
$('pauseBtn').addEventListener('click', pauseGame);
$('resumeBtn').addEventListener('click', resumeGame);
$('quitBtn').addEventListener('click', showMenu);
$('nextBtn').addEventListener('click', () => { hideOverlay(); game.nextLevel(); });
$('againBtn').addEventListener('click', onPlay);
$('menuBtn').addEventListener('click', showMenu);
document.addEventListener('contextmenu', (e) => e.preventDefault());

const input = new Input({
  dpad: $('dpad'),
  bombBtn: $('bombBtn'),
  onBomb: () => game.placeBomb(),
  onPauseKey: () => (game.state === 'pause' ? resumeGame() : pauseGame()),
});

/* ---------- Android: botão voltar e segundo plano ---------- */

function onBack() {
  if (game.state === 'play' || game.state === 'intro') return pauseGame();
  switch (screen) {
    case 'pause': return resumeGame();
    case 'title':
    case 'menu': return exitApp();
    case 'clear': return; // não deixa perder a partida por engano
    default: return showMenu();
  }
}

setupPlatform({
  onBack,
  onBackground: () => { pauseGame(); input.reset(); sound.suspend(); },
  onForeground: () => { sound.resume(); needsDraw = true; },
});

/* ---------- laço principal ---------- */

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.wantDir = input.dir;
  game.update(dt);
  if (hudDirty) updateHud();
  // Com o jogo parado (menu, pausa) o canvas não é redesenhado: economiza bateria.
  const animating = game.state === 'play' || game.state === 'intro' || renderer.shake > 0 || game.particleCount > 0;
  if (animating || needsDraw) {
    renderer.draw(game, now, dt);
    needsDraw = false;
  }
  requestAnimationFrame(frame);
}

function fit() {
  renderer.resize(arena.clientWidth, arena.clientHeight, game);
  needsDraw = true;
}

async function boot() {
  $('version').textContent = 'v' + __APP_VERSION__;
  game.buildLevel(); // fase de fundo atrás do menu
  // Os sprites usam a fonte pixelada; espera ela carregar (é local, então é rápido).
  await Promise.race([
    document.fonts.load('16px "Press Start 2P"').catch(() => {}),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
  fit();
  new ResizeObserver(fit).observe(arena);
  show('title');
  updateHud();
  requestAnimationFrame((t) => { last = t; frame(t); });
}

boot();
