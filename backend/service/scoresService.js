// service/scoresService.js
const scoresData = require('./../data/scores');

/**
 * Submit a score after a game ends
 */
async function submitScore({ email, username, score, wordsUsed }) {
  if (!email) throw new Error('email is required');
  if (score === undefined || score === null) throw new Error('score is required');
  if (wordsUsed === undefined || wordsUsed === null) throw new Error('wordsUsed is required');
  if (!Number.isInteger(score)) throw new Error('score must be an integer');
  if (!Number.isInteger(wordsUsed)) throw new Error('wordsUsed must be an integer');
  if (score < 0) throw new Error('score cannot be negative');
  if (wordsUsed < 0) throw new Error('wordsUsed cannot be negative');

  const displayName = username || email.split('@')[0];
  return scoresData.saveScore({ email, username: displayName, score, wordsUsed });
}

/**
 * Strip a score row down to what is safe to show publicly (no email).
 */
function toPublicScore({ username, score, words_used, created_at }) {
  return { username, score, words_used, created_at };
}

/**
 * Get the top 10 leaderboard (one row per player). Emails are never
 * returned; when `email` is given, that player's row is flagged `isMe` and
 * their rank and personal best are returned as `me`.
 */
async function getLeaderboard(email) {
  const rows = await scoresData.getTopScores();
  const scores = rows.map(row => ({ ...toPublicScore(row), isMe: !!email && row.email === email }));
  if (!email) return { scores, me: null };

  const [best, rank] = await Promise.all([
    scoresData.getPersonalBest(email),
    scoresData.getRank(email),
  ]);
  return { scores, me: best ? { rank, best: toPublicScore(best) } : null };
}

/**
 * Get personal best for a player
 */
async function getPersonalBest(email) {
  if (!email) throw new Error('email is required');
  const best = await scoresData.getPersonalBest(email);
  return best ? toPublicScore(best) : null;
}

module.exports = {
  submitScore,
  getLeaderboard,
  getPersonalBest,
};
