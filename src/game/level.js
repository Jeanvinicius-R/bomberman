// Geração de fases. Funções puras: recebem o gerador aleatório para poderem ser testadas.
import { COLS, ROWS, EMPTY, WALL, BLOCK, DLIST } from '../config.js';

export const idx = (c, r) => r * COLS + c;

export function levelConfig(level) {
  const total = Math.min(2 + level, 10);
  const chasers = level >= 3 ? Math.min(Math.floor((level - 1) / 2), total - 1) : 0;
  const ghosts = level >= 5 ? Math.min(Math.floor((level - 3) / 2), total - chasers - 1) : 0;
  return {
    blobs: total - chasers - ghosts,
    chasers,
    ghosts,
    speed: Math.min(1.3 + 0.12 * level, 2.8),
    density: Math.min(0.46 + 0.02 * level, 0.62),
    time: Math.max(100, 210 - 10 * level),
  };
}

export function levelHint(level) {
  if (level === 1) return 'Elimine os monstros e ache a porta';
  if (level === 3) return 'Novo: Caçadores perseguem você!';
  if (level === 5) return 'Novo: Fantasmas atravessam blocos!';
  if (level % 5 === 0) return 'Fase especial: muito perigo!';
  return 'Mais inimigos e mais rápidos';
}

const isBorderOrPillar = (c, r) =>
  r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0);

// Canto inicial do jogador: nada de blocos nem inimigos perto dele.
const SAFE_SUM = 9;

export function generateLevel(level, rng = Math.random) {
  const cfg = levelConfig(level);
  const grid = new Uint8Array(COLS * ROWS);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid[idx(c, r)] = isBorderOrPillar(c, r) ? WALL : rng() < cfg.density ? BLOCK : EMPTY;
    }
  }
  grid[idx(1, 1)] = grid[idx(2, 1)] = grid[idx(1, 2)] = EMPTY;

  const candidates = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[idx(c, r)] === BLOCK && c + r > SAFE_SUM - 1) candidates.push({ c, r });
    }
  }
  const door = candidates.length
    ? candidates[Math.floor(rng() * candidates.length)]
    : { c: COLS - 2, r: ROWS - 2 };
  grid[idx(door.c, door.r)] = BLOCK;

  const types = [];
  for (let i = 0; i < cfg.blobs; i++) types.push('blob');
  for (let i = 0; i < cfg.chasers; i++) types.push('chaser');
  for (let i = 0; i < cfg.ghosts; i++) types.push('ghost');

  const enemies = [];
  for (let tries = 0; types.length && tries < 800; tries++) {
    const c = 1 + Math.floor(rng() * (COLS - 2));
    const r = 1 + Math.floor(rng() * (ROWS - 2));
    if (grid[idx(c, r)] === WALL || c + r < SAFE_SUM || (c === door.c && r === door.r)) continue;
    if (enemies.some((e) => e.x === c && e.y === r)) continue;
    const type = types.pop();
    if (type !== 'ghost') grid[idx(c, r)] = EMPTY;
    const mult = type === 'chaser' ? 1.15 : type === 'ghost' ? 0.85 : 1;
    enemies.push({ type, x: c, y: r, speed: cfg.speed * mult, dir: DLIST[Math.floor(rng() * 4)] });
  }

  return { cfg, grid, door, enemies };
}
