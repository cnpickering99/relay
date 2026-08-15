// controller/scoresController.js
const scoresService = require('./../service/scoresService');

function handleError(res, err) {
  const badRequest = [
    'username is required',
    'score is required',
    'wordsUsed is required',
    'score cannot be negative',
  ];
  if (badRequest.includes(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  console.error('Unexpected error in scoresController:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

/**
 * POST /scores/submit
 * Body: { username, score, wordsUsed }
 */
async function submitScore(req, res) {
  try {
    const { username, score, wordsUsed } = req.body;
    const saved = await scoresService.submitScore({ username, score, wordsUsed });
    return res.status(201).json({ score: saved });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * GET /scores/leaderboard
 */
async function getLeaderboard(req, res) {
  try {
    const scores = await scoresService.getLeaderboard();
    return res.status(200).json({ scores });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * GET /scores/personal-best?username=...
 */
async function getPersonalBest(req, res) {
  try {
    const { username } = req.query;
    const best = await scoresService.getPersonalBest(username);
    if (!best) {
      return res.status(404).json({ error: 'No scores found for this user' });
    }
    return res.status(200).json({ best });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  submitScore,
  getLeaderboard,
  getPersonalBest,
};