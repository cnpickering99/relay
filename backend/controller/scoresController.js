// controller/scoresController.js
const scoresService = require('./../service/scoresService');
const usersService = require('./../service/usersService');

function handleError(res, err) {
  const badRequest = [
    'email is required',
    'score is required',
    'wordsUsed is required',
    'score must be an integer',
    'wordsUsed must be an integer',
    'score cannot be negative',
    'wordsUsed cannot be negative',
  ];
  if (badRequest.includes(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  console.error('Unexpected error in scoresController:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

/**
 * Best-effort auth for public routes: returns the user if valid
 * credentials were sent, otherwise null (never rejects the request).
 */
async function optionalUser(req) {
  const email = req.header('x-user-email');
  const authHeader = req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!email || !token) return null;

  try {
    return await usersService.validateAuthToken(email, token);
  } catch {
    return null;
  }
}

/**
 * POST /scores/submit   (requires authenticate middleware)
 * Body: { score, wordsUsed } — identity comes from req.user, never the body.
 */
async function submitScore(req, res) {
  try {
    const { score, wordsUsed } = req.body;
    const saved = await scoresService.submitScore({
      email: req.user.email,
      username: req.user.username,
      score,
      wordsUsed,
    });
    return res.status(201).json({ score: saved });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * GET /scores/leaderboard
 * Public. If valid auth headers are sent, the response also includes `me`.
 */
async function getLeaderboard(req, res) {
  try {
    const user = await optionalUser(req);
    const { scores, me } = await scoresService.getLeaderboard(user?.email);
    return res.status(200).json({ scores, me });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * GET /scores/personal-best   (requires authenticate middleware)
 */
async function getPersonalBest(req, res) {
  try {
    const best = await scoresService.getPersonalBest(req.user.email);
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
