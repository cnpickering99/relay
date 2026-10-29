// usersService.js
//
// Service layer for public.users
//
// Sits between controllers/routes and usersDataLayer.js. Owns the
// business logic for the one-click email login flow:
//
//   1. requestLogin        -> find-or-create the user by email, issue a
//                              fresh one-click login token
//   2. verifyEmail         -> checks the token, then issues an auth token
//   3. validateAuthToken   -> checks a token is valid and not expired
//   4. logout              -> clears the auth token
//   5. getProfile          -> returns a safe (non-sensitive) view of a user
//
// Tokens are generated with Node's built-in `crypto` module — no
// external dependencies required.
//
// Note: the `verificationcode`/`vcexpierytime` columns predate this flow
// (they used to hold a short 6-digit code). They're reused as-is here to
// hold the one-click login token + its expiry — same purpose (a
// short-lived secret proving email ownership), just a longer random
// value now. No schema change needed.

const crypto = require('crypto');
const usersDataLayer = require('./../data/users');

const LOGIN_TOKEN_TTL_MINUTES = 15;
const AUTH_TOKEN_TTL_HOURS = 24;

/**
 * Generate a secure random auth token (hex string).
 */
function generateAuthToken() {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex string
}

/**
 * Derive the short numeric code shown in the login email from a login
 * token. It's a pure function of the token, so nothing extra is stored.
 */
function loginCodeFor(loginToken) {
  const digits = crypto.createHash('sha256').update(loginToken).digest().readUInt32BE(0) % 1000000;
  return String(digits).padStart(6, '0');
}

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Strip sensitive fields before returning a user to a client.
 * @param {Object} user
 * @returns {Object}
 */
function toSafeUser(user) {
  if (!user) return null;
  const { verificationcode, authenticationtoken, ...safe } = user;
  return safe;
}

/**
 * Issue a fresh one-click login token for a user and persist it
 * (reusing the verificationcode/vcexpierytime columns).
 *
 * @param {Object} user - a user row with at least `email`
 * @returns {Promise<{ user: Object, loginToken: string, loginCode: string }>}
 */
async function issueLoginToken(user) {
  const loginToken = generateAuthToken();
  const expiry = minutesFromNow(LOGIN_TOKEN_TTL_MINUTES);
  const updated = await usersDataLayer.setVerificationCode(user.email, loginToken, expiry);
  return { user: toSafeUser(updated), loginToken, loginCode: loginCodeFor(loginToken) };
}

/**
 * Request a one-click login link for an email. Creates the account on
 * the fly if one doesn't already exist for that email — there is no
 * separate "register" step and no way for the caller to tell which case
 * happened (same shape either way).
 *
 * @param {string} email
 * @returns {Promise<{ user: Object, loginToken: string }>}
 */
async function requestLogin(email) {
  if (!email) {
    throw new Error('email is required');
  }

  let user = await usersDataLayer.getUserByEmail(email);
  if (!user) {
    user = await usersDataLayer.createUser({ email });
  }

  // Return the plaintext token so the caller (e.g. a controller) can
  // email it. It is NOT included in toSafeUser's output.
  return issueLoginToken(user);
}

/**
 * Verify a user's one-click login token (the `code` param holds the
 * token from the emailed login link).
 * On success: clears the token and issues a new auth token.
 *
 * @param {string} email
 * @param {string} code
 * @returns {Promise<{ user: Object, authToken: string }>}
 */
async function verifyEmail(email, code) {
  const user = await usersDataLayer.getUserByEmail(email);
  if (!user) {
    throw new Error('No user found with this email');
  }

  if (!user.verificationcode || !user.vcexpierytime) {
    throw new Error('No verification code is pending for this user');
  }

  // Accept either the full link token or the 6-digit code derived from it
  if (user.verificationcode !== code && loginCodeFor(user.verificationcode) !== code) {
    throw new Error('Invalid verification code');
  }

  if (new Date(user.vcexpierytime).getTime() < Date.now()) {
    throw new Error('Verification code has expired');
  }

  // Code is valid: clear it and issue an auth token in one logical step
  await usersDataLayer.clearVerificationCode(email);

  const authToken = generateAuthToken();
  const atExpiry = hoursFromNow(AUTH_TOKEN_TTL_HOURS);
  const updated = await usersDataLayer.setAuthToken(email, authToken, atExpiry);
  const finalUser = await usersDataLayer.updateLastLogin(email);

  return { user: toSafeUser({ ...updated, lastlogintime: finalUser.lastlogintime }), authToken };
}

/**
 * Validate that a given auth token is correct and not expired for a user.
 *
 * @param {string} email
 * @param {string} token
 * @returns {Promise<Object>} the safe user object if valid
 * @throws if the token is missing, invalid, or expired
 */
async function validateAuthToken(email, token) {
  const user = await usersDataLayer.getUserByEmail(email);
  if (!user) {
    throw new Error('No user found with this email');
  }

  if (!user.authenticationtoken || !user.atexpirerytime) {
    throw new Error('No active session for this user');
  }

  if (user.authenticationtoken !== token) {
    throw new Error('Invalid auth token');
  }

  if (new Date(user.atexpirerytime).getTime() < Date.now()) {
    throw new Error('Auth token has expired');
  }

  return toSafeUser(user);
}

/**
 * Log a user out by clearing their auth token.
 *
 * @param {string} email
 * @returns {Promise<Object>} the safe user object
 */
async function logout(email) {
  const user = await usersDataLayer.clearAuthToken(email);
  if (!user) {
    throw new Error('No user found with this email');
  }
  return toSafeUser(user);
}

/**
 * Get a safe (non-sensitive) view of a user's profile.
 *
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function getProfile(email) {
  const user = await usersDataLayer.getUserByEmail(email);
  return toSafeUser(user);
}

/**
 * Update a user's basic profile info (currently just username).
 *
 * @param {string} email
 * @param {Object} fields
 * @param {string} [fields.username]
 * @returns {Promise<Object>} the safe, updated user
 */
async function updateProfile(email, fields) {
  const allowed = {};
  if (fields.username !== undefined) {
    allowed.username = fields.username;
  }

  if (Object.keys(allowed).length === 0) {
    throw new Error('No valid profile fields provided to update');
  }

  const updated = await usersDataLayer.updateUserByEmail(email, allowed);
  if (!updated) {
    throw new Error('No user found with this email');
  }
  return toSafeUser(updated);
}

module.exports = {
  requestLogin,
  verifyEmail,
  validateAuthToken,
  logout,
  getProfile,
  updateProfile,
  // exported for testing/reuse
  generateAuthToken,
  toSafeUser,
};