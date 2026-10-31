import { describe, it, expect, vi } from 'vitest';
import { Game } from '../src/game/game.js';
import { idx } from '../src/game/level.js';
import { BLOCK, EMPTY, WALL, DIRS, RULES } from '../src/config.js';

function playing(events = {}) {
  const g = new Game({ rng: () => 0.99, events }); // 0.99: quase nenhum bloco nem item aleatório
  g.newGame();
  g.enemies = [];
  g.state = 'play';
  return g;
}

describe('Game', () => {
  it('a bomba explode após o pavio e quebra blocos no alcance', () => {
    const g = playing();
    g.grid[idx(3, 1)] = BLOCK;
    g.placeBomb();
    expect(g.bombs.length).toBe(1);
    g.player.inv = 99;
    for (let t = 0; t < RULES.bombFuse + 0.1; t += 0.05) g.update(0.05);
    expect(g.bombs.length).toBe(0);
    expect(g.grid[idx(3, 1)]).toBe(EMPTY);
    expect(g.score).toBeGreaterThanOrEqual(RULES.score.block);
  });

  it('respeita o limite de bombas do jogador', () => {
    const g = playing();
    expect(g.placeBomb()).toBe(true);
    expect(g.placeBomb()).toBe(false);
  });

  it('explosões em cadeia detonam a bomba vizinha', () => {
    const g = playing();
    g.player.inv = 99;
    g.bombs.push({ c: 1, r: 1, t: 0.01, range: 2, pass: false }, { c: 3, r: 1, t: 99, range: 2, pass: false });
    g.update(0.05);
    expect(g.bombs.length).toBe(0);
    expect(g.flames[idx(5, 1)]).toBeGreaterThan(0);
  });

  it('a explosão para na parede', () => {
    const g = playing();
    g.player.inv = 99;
    expect(g.grid[idx(2, 2)]).toBe(WALL);
    g.bombs.push({ c: 2, r: 1, t: 0.01, range: 5, pass: false });
    g.update(0.05);
    expect(g.flames[idx(2, 3)]).toBe(0);
  });

  it('perde vida na chama e termina o jogo na última', () => {
    const over = vi.fn();
    const g = playing({ over });
    g.lives = 1;
    g.player.inv = 0;
    g.flames[idx(1, 1)] = 1;
    g.update(0.016);
    expect(g.lives).toBe(0);
    expect(g.state).toBe('over');
    expect(over).toHaveBeenCalledWith({ score: g.score, level: 1 });
  });

  it('o jogador anda até a próxima célula livre', () => {
    const g = playing();
    g.player.inv = 99;
    g.grid[idx(2, 1)] = EMPTY;
    g.wantDir = DIRS.right;
    for (let i = 0; i < 10; i++) g.update(0.02);
    g.wantDir = null;
    for (let i = 0; i < 20; i++) g.update(0.02);
    expect(g.player.x).toBeGreaterThanOrEqual(2);
    expect(Number.isInteger(g.player.x)).toBe(true);
  });

  it('ganha vida extra a cada 5000 pontos, até o máximo', () => {
    const g = playing();
    g.addScore(RULES.extraLifeEvery * 20);
    expect(g.lives).toBe(RULES.maxLives);
  });

  it('completa a fase ao entrar na porta aberta sem inimigos', () => {
    const clear = vi.fn();
    const g = playing({ clear });
    g.door = { c: 1, r: 1 };
    g.grid[idx(1, 1)] = EMPTY;
    g.player.inv = 99;
    g.update(0.016);
    expect(g.state).toBe('clear');
    expect(clear).toHaveBeenCalledOnce();
  });

  it('pausar e continuar volta para o estado anterior', () => {
    const g = playing();
    g.state = 'intro';
    expect(g.pause()).toBe(true);
    expect(g.state).toBe('pause');
    g.resume();
    expect(g.state).toBe('intro');
  });

  it('o tempo esgotado tira uma vida e dá prorrogação', () => {
    const g = playing();
    g.player.inv = 99;
    g.timeLeft = 0.01;
    const lives = g.lives;
    g.update(0.05);
    expect(g.lives).toBe(lives - 1);
    expect(g.timeLeft).toBe(RULES.overtime);
  });
});
