import crypto from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
// Bytes at or above this would make `byte % 62` favour the first characters.
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

export const GAME_ID_RE = /^[0-9A-Za-z]{8}$/;

// 8 random base62 characters. Callers retry on the rare duplicate key.
export function gameId(length = 8) {
  let id = '';
  while (id.length < length) {
    for (const byte of crypto.randomBytes(length * 2)) {
      if (byte < UNBIASED_LIMIT && id.length < length) id += ALPHABET[byte % ALPHABET.length];
    }
  }
  return id;
}
