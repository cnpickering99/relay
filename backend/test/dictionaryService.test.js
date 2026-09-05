const {
  MIN_CHAIN_SCORE,
  createDictionaryService,
  normalizeWord,
} = require('../service/dictionaryService');
const { ValidationReason } = require('../multiplayer/enums');

function response(body, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe('dictionaryService', () => {
  it('defines immutable validation reasons', () => {
    expect(ValidationReason).toEqual({
      NOT_A_WORD: 'NOT_A_WORD',
      UNCHAINABLE: 'UNCHAINABLE',
    });
    expect(Object.isFrozen(ValidationReason)).toBe(true);
  });

  it('normalizes words for server validation', () => {
    expect(normalizeWord('  RoAcH ')).toBe('roach');
    expect(normalizeWord(null)).toBe('');
  });

  it('accepts a real, chainable word', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response([{ word: 'roach', score: 20 }]))
      .mockResolvedValueOnce(response([{ word: 'chime', score: MIN_CHAIN_SCORE + 1 }]));
    const dictionary = createDictionaryService({ fetchImpl });

    await expect(dictionary.validateWord(' ROACH ')).resolves.toEqual({ valid: true });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://api.datamuse.com/words?sp=roach&max=1'
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://api.datamuse.com/words?sp=ch*&max=10'
    );
  });

  it('rejects a word that is not in the dictionary', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response([{ word: 'other', score: 100 }]));
    const dictionary = createDictionaryService({ fetchImpl });

    await expect(dictionary.validateWord('ROACH')).resolves.toEqual({
      valid: false,
      reason: 'NOT_A_WORD',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a real word that cannot continue the chain', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response([{ word: 'roach', score: 20 }]))
      .mockResolvedValueOnce(response([{ word: 'chime', score: MIN_CHAIN_SCORE }]));
    const dictionary = createDictionaryService({ fetchImpl });

    await expect(dictionary.validateWord('ROACH')).resolves.toEqual({
      valid: false,
      reason: 'UNCHAINABLE',
      lastTwo: 'CH',
    });
  });

  it('propagates dictionary request failures', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response([], false, 503));
    const dictionary = createDictionaryService({ fetchImpl });

    await expect(dictionary.isRealWord('roach')).rejects.toThrow(
      'dictionary request failed with status 503'
    );
  });
});
