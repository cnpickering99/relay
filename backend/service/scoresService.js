// service/scoresService.js
const scoresData = require('./../data/scores');

/**
 * Submit a score after a game ends
 */
async function submitScore({ username, score, wordsUsed }) {
  if (!username) throw new Error('username is required');
  if (score === undefined || score === null) throw new Error('score is required');
  if (!wordsUsed) throw new Error('wordsUsed is required');
  if (score < 0) throw new Error('score cannot be negative');

  const saved = await scoresData.saveScore({ username, score, wordsUsed });
  return saved;
}

/**
 * Get the top 10 leaderboard
 */
async function getLeaderboard() {
  const scores = await scoresData.getTopScores();
  return scores;
}

/**
 * Get personal best for a username
 */
async function getPersonalBest(username) {
  if (!username) throw new Error('username is required');
  const best = await scoresData.getPersonalBest(username);
  return best;
}

module.exports = {
  submitScore,
  getLeaderboard,
  getPersonalBest,
};