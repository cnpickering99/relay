// usersController.js
//
// Express controller layer for the one-click email login flow.
// Translates HTTP requests <-> usersService calls, and maps service
// errors to appropriate HTTP status codes.
//
// Expected request shapes (adjust to match your route definitions):
//
//   POST   /users/login               { email }              -> emails a one-click login link (creates the account first if the email is new; same response either way)
//   POST   /users/verify              { email, token }        -> exchanges the link's token for an auth token
//   POST   /users/logout              { email }            (or via req.user.email if using authenticate middleware)
//   GET    /users/profile             ?email=...            (or via req.user.email if using authenticate middleware)
//   PATCH  /users/profile             { email, username? }  (or via req.user.email if using authenticate middleware)
//
// Auth header convention for protected routes:
//   Authorization: Bearer <token>
//   x-user-email: <email>
//   (Token alone isn't enough to look up a user since there's no
//   index/uniqueness on the token column — see authenticate middleware below.)

const usersService = require('./../service/usersService');
const sendEmail = require('./../scripts/send-email');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Build the one-click login link and email it to the user.
 * Never throws: a failed send is logged and reported back as
 * `emailSent: false` rather than failing the whole request, since the
 * account/token already exist in the DB by the time this runs.
 *
 * @param {string} email
 * @param {string} loginToken
 * @returns {Promise<boolean>} whether the email actually went out
 */
async function sendLoginLinkEmail(email, loginToken) {
  const link = `${FRONTEND_URL}/?token=${encodeURIComponent(loginToken)}&email=${encodeURIComponent(email)}`;
  const body = `
    <p>Click below to log in to Relay:</p>
    <p><a href="${link}">Log In to Relay</a></p>
    <p>This link expires in 15 minutes and can only be used once.</p>
  `;

  try {
    await sendEmail(email, 'Log in to Relay', body);
    return true;
  } catch (err) {
    console.error('Failed to send login-link email:', err);
    return false;
  }
}

/**
 * Maps a thrown Error's message to an HTTP status code.
 * Falls back to 500 for anything unrecognized.
 */
function statusForError(message) {
  const notFoundMessages = [
    'No user found with this email',
    'No active session for this user',
  ];
  const badRequestMessages = [
    'email is required',
    'Invalid verification code',
    'Verification code has expired',
    'No verification code is pending for this user',
    'No valid profile fields provided to update',
  ];
  const unauthorizedMessages = ['Invalid auth token', 'Auth token has expired'];

  if (notFoundMessages.includes(message)) return 404;
  if (badRequestMessages.includes(message)) return 400;
  if (unauthorizedMessages.includes(message)) return 401;
  return 500;
}

function handleError(res, err) {
  const status = statusForError(err.message);
  if (status === 500) {
    // Don't leak internal error details for unexpected failures
    console.error('Unexpected error in usersController:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
  return res.status(status).json({ error: err.message });
}

/**
 * POST /users/login
 * Body: { email }
 *
 * Emails a one-click login link. If the email doesn't have an account
 * yet, one is created silently first — there is no separate "register"
 * step, and the response is identical either way.
 */
async function login(req, res) {
  try {
    const { email } = req.body;
    const { user, loginToken } = await usersService.requestLogin(email);
    const emailSent = await sendLoginLinkEmail(email, loginToken);
    return res.status(200).json({ user, emailSent });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * POST /users/verify
 * Body: { email, token }
 */
async function verifyEmail(req, res) {
  try {
    const { email, token } = req.body;
    const { user, authToken } = await usersService.verifyEmail(email, token);
    return res.status(200).json({ user, authToken });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * POST /users/logout
 * Body: { email }
 * (If using the `authenticate` middleware on this route instead,
 * swap `req.body.email` for `req.user.email`.)
 */
async function logout(req, res) {
  try {
    const email = req.body.email || (req.user && req.user.email);
    const user = await usersService.logout(email);
    return res.status(200).json({ user });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * GET /users/profile?email=...
 * (If using the `authenticate` middleware, swap for `req.user.email`.)
 */
async function getProfile(req, res) {
  try {
    const email = req.query.email || (req.user && req.user.email);
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    const profile = await usersService.getProfile(email);
    if (!profile) {
      return res.status(404).json({ error: 'No user found with this email' });
    }
    return res.status(200).json({ user: profile });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * PATCH /users/profile
 * Body: { email, username? }
 * (If using the `authenticate` middleware, swap for `req.user.email`.)
 */
async function updateProfile(req, res) {
  try {
    const email = req.body.email || (req.user && req.user.email);
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    const { username } = req.body;
    const user = await usersService.updateProfile(email, { username });
    return res.status(200).json({ user });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * Express middleware to protect routes with the issued auth token.
 *
 * Expects:
 *   Authorization: Bearer <token>
 *   x-user-email: <email>
 *
 * On success, attaches req.user = { email, ...safe user fields }
 * and calls next(). On failure, responds with 401/404 directly.
 */
async function authenticate(req, res, next) {
  try {
    const email = req.header('x-user-email');
    const authHeader = req.header('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!email || !token) {
      return res.status(401).json({ error: 'Missing credentials' });
    }

    const user = await usersService.validateAuthToken(email, token);
    req.user = user;
    return next();
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  login,
  verifyEmail,
  logout,
  getProfile,
  updateProfile,
  authenticate,
};