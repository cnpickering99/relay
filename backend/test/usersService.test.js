// usersService.test.js
//
// Integration tests for usersService.js
// Runs against a REAL Postgres test database (same approach as
// usersDataLayer.test.js) — no mocking of the DB layer.
//
// Setup:
//   1. Point env vars (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)
//      at a TEST database before running. Do NOT run against production.
//   2. Run with: npx jest usersService.test.js

const pool = require('./../data/db');
const usersDataLayer = require('./../data/users');
const usersService = require('./../service/usersService');

const TEST_PREFIX = `jest_service_${Date.now()}`;
const createdEmails = [];

function uniqueEmail(label) {
  const email = `${TEST_PREFIX}_${label}@example.com`;
  createdEmails.push(email);
  return email;
}

beforeAll(async () => {
  await pool.query('SELECT 1;');
});

afterAll(async () => {
  if (createdEmails.length > 0) {
    await pool.query('DELETE FROM public.users WHERE email = ANY($1::text[]);', [createdEmails]);
  }
  await pool.end();
});

describe('registerUser', () => {
  it('creates a user and returns a verification code', async () => {
    const email = uniqueEmail('register');

    const { user, verificationCode } = await usersService.registerUser({
      email,
      username: 'newuser',
    });

    expect(user.email).toBe(email);
    expect(user.username).toBe('newuser');
    expect(verificationCode).toMatch(/^\d{6}$/);

    // Safe user should never expose the raw code/token fields
    expect(user.verificationcode).toBeUndefined();
    expect(user.authenticationtoken).toBeUndefined();

    // But the code should actually be persisted in the DB
    const raw = await usersDataLayer.getUserByEmail(email);
    expect(raw.verificationcode).toBe(verificationCode);
    expect(raw.vcexpierytime).toBeTruthy();
  });

  it('throws if email is missing', async () => {
    await expect(usersService.registerUser({ username: 'no_email' })).rejects.toThrow(
      'email is required'
    );
  });

  it('throws if a user with that email already exists', async () => {
    const email = uniqueEmail('duplicate');
    await usersService.registerUser({ email, username: 'first' });

    await expect(usersService.registerUser({ email, username: 'second' })).rejects.toThrow(
      'A user with this email already exists'
    );
  });
});

describe('resendVerificationCode', () => {
  it('issues a new code for an existing user', async () => {
    const email = uniqueEmail('resend');
    const { verificationCode: firstCode } = await usersService.registerUser({ email });

    const { verificationCode: secondCode } = await usersService.resendVerificationCode(email);

    expect(secondCode).toMatch(/^\d{6}$/);
    // Extremely unlikely to collide, but the important guarantee is that
    // the DB now reflects the second code, not the first
    const raw = await usersDataLayer.getUserByEmail(email);
    expect(raw.verificationcode).toBe(secondCode);
    if (firstCode === secondCode) {
      // astronomically unlikely; not a real failure, just noting it
      console.warn('Generated codes collided by chance');
    }
  });

  it('throws if no user exists with that email', async () => {
    await expect(usersService.resendVerificationCode('nope_999@example.com')).rejects.toThrow(
      'No user found with this email'
    );
  });
});

describe('verifyEmail', () => {
  it('verifies a correct, unexpired code and issues an auth token', async () => {
    const email = uniqueEmail('verify_success');
    const { verificationCode } = await usersService.registerUser({ email });

    const { user, authToken } = await usersService.verifyEmail(email, verificationCode);

    expect(authToken).toMatch(/^[0-9a-f]{64}$/);
    expect(user.email).toBe(email);
    expect(user.authenticationtoken).toBeUndefined(); // stripped from safe user
    expect(user.lastlogintime).toBeTruthy();

    // Verify side effects directly in the DB
    const raw = await usersDataLayer.getUserByEmail(email);
    expect(raw.verificationcode).toBeNull();
    expect(raw.vcexpierytime).toBeNull();
    expect(raw.authenticationtoken).toBe(authToken);
    expect(raw.atexpirerytime).toBeTruthy();
  });

  it('throws for an incorrect code', async () => {
    const email = uniqueEmail('verify_wrong_code');
    await usersService.registerUser({ email });

    await expect(usersService.verifyEmail(email, '000000')).rejects.toThrow(
      'Invalid verification code'
    );
  });

  it('throws for an expired code', async () => {
    const email = uniqueEmail('verify_expired');
    const { verificationCode } = await usersService.registerUser({ email });

    // Manually expire the code by setting vcexpierytime in the past
    await usersDataLayer.setVerificationCode(
      email,
      verificationCode,
      new Date(Date.now() - 60 * 1000)
    );

    await expect(usersService.verifyEmail(email, verificationCode)).rejects.toThrow(
      'Verification code has expired'
    );
  });

  it('throws if no code is pending', async () => {
    const email = uniqueEmail('verify_no_code');
    await usersDataLayer.createUser({ email }); // no verification code set

    await expect(usersService.verifyEmail(email, '123456')).rejects.toThrow(
      'No verification code is pending for this user'
    );
  });

  it('throws if the user does not exist', async () => {
    await expect(usersService.verifyEmail('nope_999@example.com', '123456')).rejects.toThrow(
      'No user found with this email'
    );
  });
});

describe('validateAuthToken', () => {
  it('validates a correct, unexpired token', async () => {
    const email = uniqueEmail('token_valid');
    const { verificationCode } = await usersService.registerUser({ email });
    const { authToken } = await usersService.verifyEmail(email, verificationCode);

    const user = await usersService.validateAuthToken(email, authToken);

    expect(user.email).toBe(email);
    expect(user.authenticationtoken).toBeUndefined();
  });

  it('throws for an incorrect token', async () => {
    const email = uniqueEmail('token_wrong');
    const { verificationCode } = await usersService.registerUser({ email });
    await usersService.verifyEmail(email, verificationCode);

    await expect(usersService.validateAuthToken(email, 'wrong-token')).rejects.toThrow(
      'Invalid auth token'
    );
  });

  it('throws for an expired token', async () => {
    const email = uniqueEmail('token_expired');
    await usersDataLayer.createUser({ email });
    await usersDataLayer.setAuthToken(email, 'sometoken', new Date(Date.now() - 60 * 1000));

    await expect(usersService.validateAuthToken(email, 'sometoken')).rejects.toThrow(
      'Auth token has expired'
    );
  });

  it('throws if there is no active session', async () => {
    const email = uniqueEmail('token_none');
    await usersDataLayer.createUser({ email });

    await expect(usersService.validateAuthToken(email, 'anything')).rejects.toThrow(
      'No active session for this user'
    );
  });

  it('throws if the user does not exist', async () => {
    await expect(
      usersService.validateAuthToken('nope_999@example.com', 'anything')
    ).rejects.toThrow('No user found with this email');
  });
});

describe('logout', () => {
  it('clears the auth token', async () => {
    const email = uniqueEmail('logout');
    const { verificationCode } = await usersService.registerUser({ email });
    const { authToken } = await usersService.verifyEmail(email, verificationCode);

    await usersService.logout(email);

    await expect(usersService.validateAuthToken(email, authToken)).rejects.toThrow(
      'No active session for this user'
    );
  });

  it('throws if the user does not exist', async () => {
    await expect(usersService.logout('nope_999@example.com')).rejects.toThrow(
      'No user found with this email'
    );
  });
});

describe('getProfile', () => {
  it('returns a safe view of an existing user', async () => {
    const email = uniqueEmail('profile_get');
    await usersService.registerUser({ email, username: 'profileuser' });

    const profile = await usersService.getProfile(email);

    expect(profile.email).toBe(email);
    expect(profile.username).toBe('profileuser');
    expect(profile.verificationcode).toBeUndefined();
    expect(profile.authenticationtoken).toBeUndefined();
  });

  it('returns null for a user that does not exist', async () => {
    const profile = await usersService.getProfile('nope_999@example.com');
    expect(profile).toBeNull();
  });
});

describe('updateProfile', () => {
  it('updates the username', async () => {
    const email = uniqueEmail('profile_update');
    await usersService.registerUser({ email, username: 'old_name' });

    const updated = await usersService.updateProfile(email, { username: 'new_name' });

    expect(updated.username).toBe('new_name');
  });

  it('throws if no valid fields are provided', async () => {
    const email = uniqueEmail('profile_update_empty');
    await usersService.registerUser({ email });

    await expect(usersService.updateProfile(email, {})).rejects.toThrow(
      'No valid profile fields provided to update'
    );
  });

  it('throws if the user does not exist', async () => {
    await expect(
      usersService.updateProfile('nope_999@example.com', { username: 'x' })
    ).rejects.toThrow('No user found with this email');
  });
});

describe('token/code generators', () => {
  it('generateVerificationCode produces a 6-digit numeric string', () => {
    const code = usersService.generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('generateAuthToken produces a 64-character hex string', () => {
    const token = usersService.generateAuthToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('toSafeUser strips sensitive fields', () => {
    const safe = usersService.toSafeUser({
      email: 'a@example.com',
      username: 'a',
      verificationcode: 'secret',
      authenticationtoken: 'secret-token',
    });
    expect(safe.verificationcode).toBeUndefined();
    expect(safe.authenticationtoken).toBeUndefined();
    expect(safe.email).toBe('a@example.com');
  });

  it('toSafeUser returns null when given null', () => {
    expect(usersService.toSafeUser(null)).toBeNull();
  });
});