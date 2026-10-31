import { describe, it, expect } from 'vitest';
import { generateLevel, levelConfig, idx } from '../src/game/level.js';
import { COLS, ROWS, WALL, BLOCK, EMPTY } from '../src/config.js';

// Gerador determinístico para os testes serem reproduzíveis.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('levelConfig', () => {
  it('nunca passa de 10 inimigos e sempre tem ao menos uma gosma', () => {
    for (let l = 1; l <= 100; l++) {
      const c = levelConfig(l);
      expect(c.blobs + c.chasers + c.ghosts).toBeLessThanOrEqual(10);
      expect(c.blobs).toBeGreaterThanOrEqual(1);
      expect(c.time).toBeGreaterThanOrEqual(100);
    }
  });

  it('apresenta caçadores na fase 3 e fantasmas na fase 5', () => {
    expect(levelConfig(2).chasers).toBe(0);
    expect(levelConfig(3).chasers).toBeGreaterThan(0);
    expect(levelConfig(4).ghosts).toBe(0);
    expect(levelConfig(5).ghosts).toBeGreaterThan(0);
  });
});

describe('generateLevel', () => {
  for (const level of [1, 3, 5, 12, 40]) {
    it(`gera uma arena válida na fase ${level}`, () => {
      for (let seed = 1; seed <= 50; seed++) {
        const { grid, door, enemies, cfg } = generateLevel(level, seeded(seed * 7919 + level));

        for (let c = 0; c < COLS; c++) { expect(grid[idx(c, 0)]).toBe(WALL); expect(grid[idx(c, ROWS - 1)]).toBe(WALL); }
        for (let r = 0; r < ROWS; r++) { expect(grid[idx(0, r)]).toBe(WALL); expect(grid[idx(COLS - 1, r)]).toBe(WALL); }

        // canto inicial livre para o jogador não morrer na primeira bomba
        for (const [c, r] of [[1, 1], [2, 1], [1, 2]]) expect(grid[idx(c, r)]).toBe(EMPTY);

        expect(grid[idx(door.c, door.r)]).toBe(BLOCK);
        expect(enemies.length).toBe(cfg.blobs + cfg.chasers + cfg.ghosts);
        for (const e of enemies) {
          expect(e.x + e.y).toBeGreaterThanOrEqual(9);
          expect(grid[idx(e.x, e.y)]).not.toBe(WALL);
          if (e.type !== 'ghost') expect(grid[idx(e.x, e.y)]).toBe(EMPTY);
        }
      }
    });
  }
});
