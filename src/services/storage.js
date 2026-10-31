// Perfil e ranking salvos no aparelho. Tudo que é lido do armazenamento é validado,
// porque dados corrompidos ou editados não podem quebrar o jogo.
import { RANK_SIZE } from '../config.js';
import { isValidName } from './names.js';

const KEY_PROFILE = 'bb.profile';
const KEY_RANK = 'bb.rank';
const MAX_SCORE = 1e9;
const MAX_LEVEL = 9999;

const defaultStore = () => {
  try { return globalThis.localStorage || null; } catch { return null; }
};

function readJSON(store, key) {
  try {
    const raw = store && store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(store, key, value) {
  try { if (store) store.setItem(key, JSON.stringify(value)); } catch { /* armazenamento cheio ou bloqueado */ }
}

const int = (v, max) => (Number.isFinite(v) ? Math.min(Math.max(Math.floor(v), 0), max) : 0);

export function sanitizeProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    name: typeof p.name === 'string' && isValidName(p.name) ? p.name : '',
    seen: p.seen === true,
    sound: p.sound !== false,
    best: int(p.best, MAX_SCORE),
  };
}

export function sanitizeRanking(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === 'object' && typeof r.name === 'string' && isValidName(r.name))
    .map((r) => ({ name: r.name, score: int(r.score, MAX_SCORE), level: Math.max(1, int(r.level, MAX_LEVEL)), ts: int(r.ts, Number.MAX_SAFE_INTEGER) }))
    .sort((a, b) => b.score - a.score || a.ts - b.ts)
    .slice(0, RANK_SIZE);
}

export function createStorage(store = defaultStore()) {
  return {
    loadProfile: () => sanitizeProfile(readJSON(store, KEY_PROFILE)),
    saveProfile: (p) => writeJSON(store, KEY_PROFILE, sanitizeProfile(p)),
    loadRanking: () => sanitizeRanking(readJSON(store, KEY_RANK)),
    // Devolve o ranking atualizado e a posição da nova entrada (-1 se ficou de fora).
    addToRanking(entry) {
      const rows = sanitizeRanking(readJSON(store, KEY_RANK));
      const clean = sanitizeRanking([entry])[0];
      if (!clean) return { rows, pos: -1 };
      const next = sanitizeRanking([...rows, clean]);
      writeJSON(store, KEY_RANK, next);
      return { rows: next, pos: next.findIndex((r) => r.ts === clean.ts && r.name === clean.name && r.score === clean.score) };
    },
  };
}
