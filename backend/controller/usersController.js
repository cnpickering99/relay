// usersController.js
//
// Express controller layer for the users auth flow.
// Translates HTTP requests <-> usersService calls, and maps service
// errors to appropriate HTTP status codes.
//
// Expected request shapes (adjust to match your route definitions):
//
//   POST   /users/register            { email, username? }
//   POST   /users/resend-code         { email }
//   POST   /users/verify              { email, code }
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

/**
 * Maps a thrown Error's message to an HTTP status code.
 * Falls back to 500 for anything unrecognized.
 */
function statusForError(message) {
  const notFoundMessages = [
    'No user found with this email',
    'No active session for this user',
  ];
  const conflictMessages = ['A user with this email already exists'];
  const badRequestMessages = [
    'email is required',
    'Invalid verification code',
    'Verification code has expired',
    'No verification code is pending for this user',
    'No valid profile fields provided to update',
  ];
  const unauthorizedMessages = ['Invalid auth token', 'Auth token has expired'];

  if (notFoundMessages.includes(message)) return 404;
  if (conflictMessages.includes(message)) return 409;
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
 * POST /users/register
 * Body: { email, username? }
 */
async function register(req, res) {
  try {
    const { email, username } = req.body;
    const { user, verificationCode } = await usersService.registerUser({ email, username });

    // In a real app, send verificationCode via email here instead of
    // returning it directly. It's included in the response for now so
    // the flow is testable end-to-end without an email provider wired up.
    return res.status(201).json({ user, verificationCode });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * POST /users/resend-code
 * Body: { email }
 */
async function resendVerificationCode(req, res) {
  try {
    const { email } = req.body;
    const { user, verificationCode } = await usersService.resendVerificationCode(email);
    return res.status(200).json({ user, verificationCode });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * POST /users/verify
 * Body: { email, code }
 */
async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body;
    const { user, authToken } = await usersService.verifyEmail(email, code);
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
  register,
  resendVerificationCode,
  verifyEmail,
  logout,
  getProfile,
  updateProfile,
  authenticate,
};