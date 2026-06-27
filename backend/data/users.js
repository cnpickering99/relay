// usersDataLayer.js
//
// Data access layer for public.users
//
// NOTE: This table has no primary key defined. All single-record
// operations (find/update/delete by identity) use `email` as the
// lookup key, since it is the only NOT NULL column suited for that
// purpose. If duplicate emails exist, update/delete will affect ALL
// matching rows. Consider adding a real primary key column (e.g. a
// serial/uuid `id`) to the table to make this layer safe.

const pool = require('./db');

/**
 * Create a new user.
 * @param {Object} user
 * @param {string} user.email - required
 * @param {string} [user.username]
 * @param {string} [user.verificationcode]
 * @param {Date|string} [user.vcexpierytime]
 * @param {string} [user.authenticationtoken]
 * @param {Date|string} [user.atexpirerytime]
 * @param {Date|string} [user.lastlogintime]
 * @returns {Promise<Object>} the created user row
 */
async function createUser(user) {
  const {
    email,
    username = null,
    verificationcode = null,
    vcexpierytime = null,
    authenticationtoken = null,
    atexpirerytime = null,
    lastlogintime = null,
  } = user;

  if (!email) {
    throw new Error('email is required to create a user');
  }

  const query = `
    INSERT INTO public.users
      (username, email, verificationcode, vcexpierytime, authenticationtoken, atexpirerytime, lastlogintime)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [
    username,
    email,
    verificationcode,
    vcexpierytime,
    authenticationtoken,
    atexpirerytime,
    lastlogintime,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
}

/**
 * Get a single user by email.
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function getUserByEmail(email) {
  const query = `SELECT * FROM public.users WHERE email = $1;`;
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
}

/**
 * Get a single user by username.
 * Note: username has no uniqueness constraint, so this returns the
 * first match only. Use getUsersByUsername if duplicates are expected.
 * @param {string} username
 * @returns {Promise<Object|null>}
 */
async function getUserByUsername(username) {
  const query = `SELECT * FROM public.users WHERE username = $1 LIMIT 1;`;
  const { rows } = await pool.query(query, [username]);
  return rows[0] || null;
}

/**
 * Get all users matching a username (in case of duplicates).
 * @param {string} username
 * @returns {Promise<Object[]>}
 */
async function getUsersByUsername(username) {
  const query = `SELECT * FROM public.users WHERE username = $1;`;
  const { rows } = await pool.query(query, [username]);
  return rows;
}

/**
 * Get all users, optionally paginated.
 * @param {Object} [options]
 * @param {number} [options.limit=100]
 * @param {number} [options.offset=0]
 * @returns {Promise<Object[]>}
 */
async function getAllUsers({ limit = 100, offset = 0 } = {}) {
  const query = `
    SELECT * FROM public.users
    ORDER BY createdat DESC
    LIMIT $1 OFFSET $2;
  `;
  const { rows } = await pool.query(query, [limit, offset]);
  return rows;
}

/**
 * Update a user by email. Only provided fields are updated.
 * @param {string} email - identifies the user to update
 * @param {Object} fields - fields to update
 * @returns {Promise<Object|null>} updated row, or null if not found
 */
async function updateUserByEmail(email, fields) {
  const allowedFields = [
    'username',
    'verificationcode',
    'vcexpierytime',
    'authenticationtoken',
    'atexpirerytime',
    'lastlogintime',
  ];

  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(fields, field)) {
      setClauses.push(`${field} = $${paramIndex}`);
      values.push(fields[field]);
      paramIndex += 1;
    }
  }

  if (setClauses.length === 0) {
    throw new Error('No valid fields provided to update');
  }

  values.push(email);
  const query = `
    UPDATE public.users
    SET ${setClauses.join(', ')}
    WHERE email = $${paramIndex}
    RETURNING *;
  `;

  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

/**
 * Convenience: set verification code + expiry for a user.
 * @param {string} email
 * @param {string} code
 * @param {Date|string} expiresAt
 */
async function setVerificationCode(email, code, expiresAt) {
  return updateUserByEmail(email, {
    verificationcode: code,
    vcexpierytime: expiresAt,
  });
}

/**
 * Convenience: set auth token + expiry for a user.
 * @param {string} email
 * @param {string} token
 * @param {Date|string} expiresAt
 */
async function setAuthToken(email, token, expiresAt) {
  return updateUserByEmail(email, {
    authenticationtoken: token,
    atexpirerytime: expiresAt,
  });
}

/**
 * Convenience: clear verification code (e.g. after successful verification).
 * @param {string} email
 */
async function clearVerificationCode(email) {
  return updateUserByEmail(email, {
    verificationcode: null,
    vcexpierytime: null,
  });
}

/**
 * Convenience: clear auth token (e.g. on logout or token expiry).
 * @param {string} email
 */
async function clearAuthToken(email) {
  return updateUserByEmail(email, {
    authenticationtoken: null,
    atexpirerytime: null,
  });
}

/**
 * Convenience: update last login time to now (or a given timestamp).
 * @param {string} email
 * @param {Date|string} [timestamp] - defaults to now
 */
async function updateLastLogin(email, timestamp = new Date()) {
  return updateUserByEmail(email, { lastlogintime: timestamp });
}

/**
 * Delete a user by email.
 * @param {string} email
 * @returns {Promise<Object|null>} the deleted row, or null if not found
 */
async function deleteUserByEmail(email) {
  const query = `DELETE FROM public.users WHERE email = $1 RETURNING *;`;
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserByUsername,
  getUsersByUsername,
  getAllUsers,
  updateUserByEmail,
  setVerificationCode,
  setAuthToken,
  clearVerificationCode,
  clearAuthToken,
  updateLastLogin,
  deleteUserByEmail,
};