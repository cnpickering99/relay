const DATAMUSE_URL = 'https://api.datamuse.com/words';
const MIN_CHAIN_SCORE = 10_000;
const { ValidationReason } = require('../multiplayer/enums');

function normalizeWord(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function createDictionaryService({ fetchImpl = global.fetch } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('a fetch implementation is required');
  }

  async function request(params) {
    const url = `${DATAMUSE_URL}?${new URLSearchParams(params)}`;
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`dictionary request failed with status ${response.status}`);
    return response.json();
  }

  async function isRealWord(word) {
    const normalized = normalizeWord(word);
    if (!normalized) return false;

    const results = await request({ sp: normalized, max: '1' });
    return results.some(result => result.word?.toLowerCase() === normalized && result.score > 10);
  }

  async function isChainable(word) {
    const normalized = normalizeWord(word);
    if (normalized.length < 2) return false;

    const lastTwo = normalized.slice(-2);
    const results = await request({ sp: `${lastTwo}*`, max: '10' });
    return results.some(result => result.score > MIN_CHAIN_SCORE);
  }

  async function validateWord(word) {
    const normalized = normalizeWord(word);
    const real = await isRealWord(normalized);
    if (!real) return { valid: false, reason: ValidationReason.NOT_A_WORD };

    const chainable = await isChainable(normalized);
    if (!chainable) {
      return {
        valid: false,
        reason: ValidationReason.UNCHAINABLE,
        lastTwo: normalized.slice(-2).toUpperCase(),
      };
    }

    return { valid: true };
  }

  return { isRealWord, isChainable, validateWord };
}

module.exports = {
  DATAMUSE_URL,
  MIN_CHAIN_SCORE,
  ValidationReason,
  normalizeWord,
  createDictionaryService,
};
