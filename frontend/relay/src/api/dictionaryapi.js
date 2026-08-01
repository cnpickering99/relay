export async function isWordReal(word) {
  const wordLower = word.toLowerCase();
  try {
    const res = await fetch(
      `https://api.datamuse.com/words?sp=${wordLower}&max=1`
    );
    const data = await res.json();

    // Datamuse returns an exact match only if the word exists
    // and the score will be high enough
    if (data.length === 0) return false;
    if (data[0].word.toLowerCase() !== wordLower) return false;
    return data[0].score > 10;

  } catch (error) {
    console.error('Word check failed:', error);
    return false;
  }
}

export async function isChainable(word) {
  const lastTwo = word.slice(-2).toLowerCase();
  try {
    const url = `https://api.datamuse.com/words?sp=${lastTwo}*&max=10`;
    const res = await fetch(url);
    const data = await res.json();
    const validWords = data.filter(w => w.score > 10000);
    return validWords.length > 0;
  } catch (error) {
    console.error('Chainability check failed:', error);
    return false;
  }
}

export async function validateWord(word) {
  const real = await isWordReal(word);
  if (!real) {
    return { valid: false, reason: 'NOT_A_WORD' };
  }

  const chainable = await isChainable(word);
  if (!chainable) {
    const lastTwo = word.slice(-2).toLowerCase();
    return { valid: false, reason: 'UNCHAINABLE', lastTwo };
  }

  return { valid: true };
}