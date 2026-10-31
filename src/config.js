// Constantes e regras do jogo. Tudo que é "número mágico" de balanceamento mora aqui.

export const COLS = 13;
export const ROWS = 11;
export const TILE = 48;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;

export const EMPTY = 0;
export const WALL = 1;
export const BLOCK = 2;

export const POWER = Object.freeze({ NONE: 0, BOMB: 1, RANGE: 2, SPEED: 3, LIFE: 4 });

export const DIRS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});
export const DLIST = Object.freeze([DIRS.up, DIRS.down, DIRS.left, DIRS.right]);

export const RULES = Object.freeze({
  startLives: 3,
  maxLives: 9,
  extraLifeEvery: 5000,
  bombFuse: 2.2,
  flameTime: 0.55,
  invulnerable: 2.5,
  introTime: 2,
  overtime: 60,
  lowTime: 20,
  dropChance: 0.32,
  player: Object.freeze({
    speed: 4.2, maxSpeed: 6.5, speedStep: 0.5,
    bombs: 1, maxBombs: 6,
    range: 2, maxRange: 8,
  }),
  score: Object.freeze({ block: 10, powerup: 50, blob: 100, chaser: 200, ghost: 300 }),
});

export const NAME_MIN = 2;
export const NAME_MAX = 12;
export const RANK_SIZE = 10;
