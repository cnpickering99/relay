// data/scores.js
const pool = require('./db');

/**
 * Save a new score to the database
 */
async function saveScore({ username, score, wordsUsed }) {
  const query = `
    INSERT INTO public.scores (username, score, words_used)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [username, score, wordsUsed]);
  return rows[0];
}

/**
 * Get top 10 scores, highest first
 */
async function getTopScores() {
  const query = `
    SELECT username, score, words_used, created_at
    FROM public.scores
    ORDER BY score DESC
    LIMIT 10;
  `;
  const { rows } = await pool.query(query);
  return rows;
}

/**
 * Get top score for a specific username
 */
async function getPersonalBest(username) {
  const query = `
    SELECT username, score, words_used, created_at
    FROM public.scores
    WHERE username = $1
    ORDER BY score DESC
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [username]);
  return rows[0] || null;
}

module.exports = {
  saveScore,
  getTopScores,
  getPersonalBest,
};