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
        }
        else {
            return true;
        }
      
    }
    catch (error) {
        console.error(error);
        return false;
    }
}



