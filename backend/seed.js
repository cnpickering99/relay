// backend/seed.js
const pool = require('./data/db');

async function addFakeScores() {
  const query = `
    INSERT INTO public.scores (username, score, words_used) VALUES
      ('WordWizard', 142, 18),
      ('ChainMaster', 115, 14),
      ('LexiconKing', 98, 12),
      ('AlphaCombo', 84, 10),
      ('PuzzleNinja', 72, 9),
      ('QuickSpeller', 65, 8),
      ('VocabVibe', 50, 6),
      ('SpellBound', 42, 5),
      ('ComboCrafter', 33, 4),
      ('LetterLegend', 21, 3);
  `;

  try {
    await pool.query(query);
    console.log("SUCCESS! Fake players have been added to the database.");
  } catch (err) {
    console.error("Error inserting fake players:", err);
  } finally {
    pool.end();
  }
}

addFakeScores();