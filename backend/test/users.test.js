// usersDataLayer.test.js
//
// Integration tests for usersDataLayer.js
// These tests run against a REAL Postgres database (no mocking).
//
// Setup:
//   1. Point your env vars (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)
//      at a TEST database before running these tests. Do NOT run against
//      production — this suite creates and deletes real rows.
//   2. Make sure the public.users table exists in that database (see the
//      CREATE TABLE statement provided earlier).
//   3. Run with: npx jest usersDataLayer.test.js
//
// Each test uses a unique, timestamped email so tests don't collide with
// each other or with any pre-existing data. afterAll cleans up everything
// this suite created.

const pool = require('./../data/db');
const usersDataLayer = require('./../data/users');

// Unique-ish prefix so we can identify and clean up everything this run created
const TEST_PREFIX = `jest_test_${Date.now()}`;
const createdEmails = [];

function uniqueEmail(label) {
  const email = `${TEST_PREFIX}_${label}@example.com`;
  createdEmails.push(email);
  return email;
}

beforeAll(async () => {
  // Sanity check: make sure we can actually reach the DB before running anything
  await pool.query('SELECT 1;');
});

afterAll(async () => {
  // Clean up any rows this suite created, even if individual tests failed
  if (createdEmails.length > 0) {
    await pool.query('DELETE FROM public.users WHERE email = ANY($1::text[]);', [createdEmails]);
  }
  await pool.end();
});

describe('createUser', () => {
  it('creates a user with all fields and returns the inserted row', async () => {
    const email = uniqueEmail('create_full');
    const input = {
      email,
      username: 'testuser_full',
      verificationcode: 'VC-TEST123',
      vcexpierytime: new Date('2026-12-31T00:00:00Z'),
      authenticationtoken: 'AT-TEST456',
      atexpirerytime: new Date('2026-12-31T00:00:00Z'),
      lastlogintime: new Date('2026-01-01T00:00:00Z'),
    };

    const result = await usersDataLayer.createUser(input);

    expect(result).toBeTruthy();
    expect(result.email).toBe(email);
    expect(result.username).toBe('testuser_full');
    expect(result.verificationcode).toBe('VC-TEST123');
    expect(result.authenticationtoken).toBe('AT-TEST456');
    expect(result.createdat).toBeTruthy();
  });

  it('creates a user with only the required email field', async () => {
    const email = uniqueEmail('create_minimal');

    const result = await usersDataLayer.createUser({ email });

    expect(result).toBeTruthy();
    expect(result.email).toBe(email);
    expect(result.username).toBeNull();
    expect(result.verificationcode).toBeNull();
    expect(result.authenticationtoken).toBeNull();
    expect(result.lastlogintime).toBeNull();
  });

  it('throws an error if email is missing', async () => {
    await expect(usersDataLayer.createUser({ username: 'no_email' })).rejects.toThrow(
      'email is required to create a user'
    );
  });
});

describe('getUserByEmail', () => {
  it('retrieves a user that exists', async () => {
    const email = uniqueEmail('get_by_email');
    await usersDataLayer.createUser({ email, username: 'getme' });

    const result = await usersDataLayer.getUserByEmail(email);

    expect(result).toBeTruthy();
    expect(result.email).toBe(email);
    expect(result.username).toBe('getme');
  });

  it('returns null for a user that does not exist', async () => {
    const result = await usersDataLayer.getUserByEmail('does_not_exist_999@example.com');
    expect(result).toBeNull();
  });
});

describe('getUserByUsername / getUsersByUsername', () => {
  it('retrieves a single user by username', async () => {
    const email = uniqueEmail('get_by_username');
    const username = `${TEST_PREFIX}_uniqueuser`;
    await usersDataLayer.createUser({ email, username });

    const result = await usersDataLayer.getUserByUsername(username);

    expect(result).toBeTruthy();
    expect(result.username).toBe(username);
    expect(result.email).toBe(email);
  });

  it('retrieves all users sharing the same username', async () => {
    const sharedUsername = `${TEST_PREFIX}_shared`;
    const email1 = uniqueEmail('shared_1');
    const email2 = uniqueEmail('shared_2');
    await usersDataLayer.createUser({ email: email1, username: sharedUsername });
    await usersDataLayer.createUser({ email: email2, username: sharedUsername });

    const results = await usersDataLayer.getUsersByUsername(sharedUsername);

    expect(results.length).toBe(2);
    const emails = results.map((r) => r.email);
    expect(emails).toContain(email1);
    expect(emails).toContain(email2);
  });

  it('returns null from getUserByUsername when no match exists', async () => {
    const result = await usersDataLayer.getUserByUsername('nonexistent_username_999');
    expect(result).toBeNull();
  });
});

describe('getAllUsers', () => {
  it('returns an array and respects the limit option', async () => {
    const email1 = uniqueEmail('list_1');
    const email2 = uniqueEmail('list_2');
    await usersDataLayer.createUser({ email: email1 });
    await usersDataLayer.createUser({ email: email2 });

    const results = await usersDataLayer.getAllUsers({ limit: 1, offset: 0 });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
  });
});

describe('updateUserByEmail', () => {
  it('updates only the provided fields', async () => {
    const email = uniqueEmail('update_partial');
    await usersDataLayer.createUser({ email, username: 'original_name' });

    const updated = await usersDataLayer.updateUserByEmail(email, {
      username: 'updated_name',
    });

    expect(updated.username).toBe('updated_name');
    expect(updated.email).toBe(email);
  });

  it('returns null when updating a user that does not exist', async () => {
    const result = await usersDataLayer.updateUserByEmail('nonexistent_999@example.com', {
      username: 'wont_apply',
    });
    expect(result).toBeNull();
  });

  it('throws an error when no valid fields are provided', async () => {
    const email = uniqueEmail('update_no_fields');
    await usersDataLayer.createUser({ email });

    await expect(usersDataLayer.updateUserByEmail(email, {})).rejects.toThrow(
      'No valid fields provided to update'
    );
  });
});

describe('auth-flow convenience methods', () => {
  it('setVerificationCode sets code and expiry', async () => {
    const email = uniqueEmail('set_vc');
    await usersDataLayer.createUser({ email });

    const expiry = new Date('2026-12-31T00:00:00Z');
    const result = await usersDataLayer.setVerificationCode(email, 'VC-9999', expiry);

    expect(result.verificationcode).toBe('VC-9999');
    expect(new Date(result.vcexpierytime).toISOString()).toBe(expiry.toISOString());
  });

  it('clearVerificationCode nulls out code and expiry', async () => {
    const email = uniqueEmail('clear_vc');
    await usersDataLayer.createUser({
      email,
      verificationcode: 'VC-OLD',
      vcexpierytime: new Date(),
    });

    const result = await usersDataLayer.clearVerificationCode(email);

    expect(result.verificationcode).toBeNull();
    expect(result.vcexpierytime).toBeNull();
  });

  it('setAuthToken sets token and expiry', async () => {
    const email = uniqueEmail('set_token');
    await usersDataLayer.createUser({ email });

    const expiry = new Date('2026-12-31T00:00:00Z');
    const result = await usersDataLayer.setAuthToken(email, 'AT-9999', expiry);

    expect(result.authenticationtoken).toBe('AT-9999');
    expect(new Date(result.atexpirerytime).toISOString()).toBe(expiry.toISOString());
  });

  it('clearAuthToken nulls out token and expiry', async () => {
    const email = uniqueEmail('clear_token');
    await usersDataLayer.createUser({
      email,
      authenticationtoken: 'AT-OLD',
      atexpirerytime: new Date(),
    });

    const result = await usersDataLayer.clearAuthToken(email);

    expect(result.authenticationtoken).toBeNull();
    expect(result.atexpirerytime).toBeNull();
  });

  it('updateLastLogin sets lastlogintime to the given timestamp', async () => {
    const email = uniqueEmail('update_last_login');
    await usersDataLayer.createUser({ email });

    const loginTime = new Date('2026-06-01T12:00:00Z');
    const result = await usersDataLayer.updateLastLogin(email, loginTime);

    expect(new Date(result.lastlogintime).toISOString()).toBe(loginTime.toISOString());
  });

  it('updateLastLogin defaults to roughly now when no timestamp given', async () => {
    const email = uniqueEmail('update_last_login_default');
    await usersDataLayer.createUser({ email });

    const before = Date.now();
    const result = await usersDataLayer.updateLastLogin(email);
    const after = Date.now();

    const loginTimeMs = new Date(result.lastlogintime).getTime();
    expect(loginTimeMs).toBeGreaterThanOrEqual(before - 1000);
    expect(loginTimeMs).toBeLessThanOrEqual(after + 1000);
  });
});

describe('deleteUserByEmail', () => {
  it('deletes an existing user and returns the deleted row', async () => {
    const email = uniqueEmail('delete_me');
    await usersDataLayer.createUser({ email, username: 'temp' });

    const deleted = await usersDataLayer.deleteUserByEmail(email);
    expect(deleted).toBeTruthy();
    expect(deleted.email).toBe(email);

    const afterDelete = await usersDataLayer.getUserByEmail(email);
    expect(afterDelete).toBeNull();
  });

  it('returns null when deleting a user that does not exist', async () => {
    const result = await usersDataLayer.deleteUserByEmail('nonexistent_delete_999@example.com');
    expect(result).toBeNull();
  });
});