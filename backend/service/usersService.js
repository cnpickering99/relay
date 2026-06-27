// usersService.js
//
// Service layer for public.users
//
// Sits between controllers/routes and usersDataLayer.js. Owns the
// business logic for the auth flow:
//
//   1. registerUser        -> creates a user + generates a verification code
//   2. verifyEmail         -> checks the code, then issues an auth token
//   3. resendVerificationCode -> issues a fresh code if needed
//   4. validateAuthToken   -> checks a token is valid and not expired
//   5. logout              -> clears the auth token
//   6. getProfile          -> returns a safe (non-sensitive) view of a user
//
// Codes/tokens are generated with Node's built-in `crypto` module —
// no external dependencies required.

const crypto = require('crypto');
const usersDataLayer = require('./../data/users');

const VERIFICATION_CODE_TTL_MINUTES = 15;
const AUTH_TOKEN_TTL_HOURS = 24;

/**
 * Generate a 6-digit numeric verification code.
 * (Easy for a user to type/read from an email.)
 */
function generateVerificationCode() {
  // crypto.randomInt is uniform and cryptographically strong
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Generate a secure random auth token (hex string).
 */
function generateAuthToken() {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex string
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
 * Register a new user and generate a verification code for them.
 * Throws if a user with that email already exists.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} [params.username]
 * @returns {Promise<{ user: Object, verificationCode: string }>}
 */
async function registerUser({ email, username }) {
  if (!email) {
    throw new Error('email is required');
  }

  const existing = await usersDataLayer.getUserByEmail(email);
  if (existing) {
    throw new Error('A user with this email already exists');
  }

  const verificationCode = generateVerificationCode();
  const vcExpiry = minutesFromNow(VERIFICATION_CODE_TTL_MINUTES);

  const user = await usersDataLayer.createUser({
    email,
    username,
    verificationcode: verificationCode,
    vcexpierytime: vcExpiry,
  });

  // Return the plaintext code so the caller (e.g. a controller) can email it.
  // It is NOT included in toSafeUser's output.
  return { user: toSafeUser(user), verificationCode };
}

/**
 * Issue a fresh verification code for a user who needs to re-verify
 * (e.g. their original code expired, or they never received the email).
 *
 * @param {string} email
 * @returns {Promise<{ user: Object, verificationCode: string }>}
 */
async function resendVerificationCode(email) {
  const existing = await usersDataLayer.getUserByEmail(email);
  if (!existing) {
    throw new Error('No user found with this email');
  }

  const verificationCode = generateVerificationCode();
  const vcExpiry = minutesFromNow(VERIFICATION_CODE_TTL_MINUTES);

  const user = await usersDataLayer.setVerificationCode(email, verificationCode, vcExpiry);
  return { user: toSafeUser(user), verificationCode };
}

/**
 * Verify a user's email using their verification code.
 * On success: clears the code and issues a new auth token.
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

  if (user.verificationcode !== code) {
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
  registerUser,
  resendVerificationCode,
  verifyEmail,
  validateAuthToken,
  logout,
  getProfile,
  updateProfile,
  // exported for testing/reuse
  generateVerificationCode,
  generateAuthToken,
  toSafeUser,
};