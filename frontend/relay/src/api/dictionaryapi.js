export async function isWordReal(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching definition: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.title) {
      return false;
    } else {
      return true;
    }
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function isChainable(word) {
  const lastTwo = word.slice(-2).toLowerCase();
  try {
    const url = `https://api.datamuse.com/words?sp=${lastTwo}*&max=10`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Datamuse result:", data);

    // Only count common words (raise threshold to filter obscure results)
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