// data/scores.js
const pool = require('./db');

/**
 * Save a new score to the database
 */
async function saveScore({ email, username, score, wordsUsed }) {
  const query = `
    INSERT INTO public.scores (email, username, score, words_used)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [email, username, score, wordsUsed]);
  return rows[0];
}

/**
 * Get the top scores, one row per player (their best), highest first.
 * Ties go to whoever reached the score first.
 */
async function getTopScores(limit = 10) {
  const query = `
    SELECT email, username, score, words_used, created_at
    FROM (
      SELECT DISTINCT ON (email) email, username, score, words_used, created_at
      FROM public.scores
      ORDER BY email, score DESC, created_at ASC
    ) best
    ORDER BY score DESC, created_at ASC
    LIMIT $1;
  `;
  const { rows } = await pool.query(query, [limit]);
  return rows;
}

/**
 * Get the best score for a specific player
 */
async function getPersonalBest(email) {
  const query = `
    SELECT email, username, score, words_used, created_at
    FROM public.scores
    WHERE email = $1
    ORDER BY score DESC, created_at ASC
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
}

/**
 * Get a player's leaderboard rank (1 = best), or null if they have no scores.
 * Ties share the same rank.
 */
async function getRank(email) {
  const query = `
    SELECT rank::int
    FROM (
      SELECT email, RANK() OVER (ORDER BY MAX(score) DESC) AS rank
      FROM public.scores
      GROUP BY email
    ) ranked
    WHERE email = $1;
  `;
  const { rows } = await pool.query(query, [email]);
  return rows[0]?.rank ?? null;
}

module.exports = {
  saveScore,
  getTopScores,
  getPersonalBest,
  getRank,
};
