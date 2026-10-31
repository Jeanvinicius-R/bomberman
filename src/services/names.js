import { NAME_MIN, NAME_MAX } from '../config.js';

const NAME_RE = new RegExp(`^[\\p{L}\\p{N} _-]{${NAME_MIN},${NAME_MAX}}$`, 'u');

export function normalizeName(v) {
  return String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function isValidName(v) {
  return typeof v === 'string' && NAME_RE.test(v) && v === normalizeName(v);
}
