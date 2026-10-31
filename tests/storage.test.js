import { describe, it, expect } from 'vitest';
import { createStorage, sanitizeProfile } from '../src/services/storage.js';
import { isValidName, normalizeName } from '../src/services/names.js';

function memoryStore(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}

describe('nomes', () => {
  it('aceita apelidos comuns com acento', () => {
    for (const n of ['Ana', 'João_2', 'Zé-Bomba', 'Mãe Joana']) expect(isValidName(n)).toBe(true);
  });
  it('recusa tamanhos inválidos, símbolos e HTML', () => {
    for (const n of ['A', 'x'.repeat(13), '<b>oi</b>', 'a;drop', '  ', 'tab\tname']) expect(isValidName(n)).toBe(false);
  });
  it('normaliza espaços', () => {
    expect(normalizeName('  Ana   Maria ')).toBe('Ana Maria');
  });
});

describe('storage', () => {
  it('perfil com dados corrompidos volta ao padrão sem quebrar', () => {
    const s = createStorage(memoryStore({ 'bb.profile': '{nao é json' }));
    expect(s.loadProfile()).toEqual({ name: '', seen: false, sound: true, best: 0 });
  });

  it('descarta campos com tipo errado ou valores absurdos', () => {
    const p = sanitizeProfile({ name: '<img onerror=x>', seen: 'sim', sound: 0, best: -50, extra: 'x' });
    expect(p).toEqual({ name: '', seen: false, sound: true, best: 0 });
    expect(sanitizeProfile({ best: 1e30 }).best).toBe(1e9);
  });

  it('funciona mesmo sem localStorage disponível', () => {
    const s = createStorage(null);
    expect(s.loadRanking()).toEqual([]);
    expect(() => s.saveProfile({ name: 'Ana' })).not.toThrow();
  });

  it('mantém só os 10 melhores, em ordem, e informa a posição da nova partida', () => {
    const s = createStorage(memoryStore());
    for (let i = 1; i <= 12; i++) s.addToRanking({ name: 'Jog' + i, score: i * 100, level: 1, ts: i });
    const { rows, pos } = s.addToRanking({ name: 'Novo', score: 550, level: 3, ts: 99 });
    expect(rows.length).toBe(10);
    expect(rows[0].score).toBe(1200);
    expect(rows[pos].name).toBe('Novo');
    expect(s.addToRanking({ name: 'Fraco', score: 1, level: 1, ts: 100 }).pos).toBe(-1);
  });

  it('ignora entradas de ranking adulteradas', () => {
    const bad = JSON.stringify([{ name: 'Ok', score: 10, level: 1, ts: 1 }, { name: '<script>', score: 1e12 }, null, 'x']);
    const s = createStorage(memoryStore({ 'bb.rank': bad }));
    expect(s.loadRanking()).toEqual([{ name: 'Ok', score: 10, level: 1, ts: 1 }]);
  });
});
