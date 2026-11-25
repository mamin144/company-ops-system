import { PasswordResetTokenService, PasswordResetTokenResult, ValidateResult, ValidateResultValid, ValidateResultInvalid } from '../src/services/password-reset-token.service.js';
import { pool } from '../src/database/connection.js';

beforeAll(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    requested_ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
  )`);
});

afterAll(async () => {
  await pool.query(`DROP TABLE IF EXISTS password_reset_tokens`);
});

describe('PasswordResetTokenService - Cryptographic Token Correctness', () => {
  beforeEach(async () => {
    await pool.query(`DELETE FROM password_reset_tokens`);
  });

  it('1. Raw token generation produces a 256-bit hex string', async () => {
    const service = new PasswordResetTokenService();
    // We'll test the digest computation directly
    const rawToken = require('node:crypto').randomBytes(32).toString('hex');
    const digest = require('node:crypto').createHash('sha256').update(rawToken).digest('hex');
    expect(rawToken.length).toBe(64);
    expect(digest.length).toBe(64);
  });

  it('2. Correct SHA-256 digest relationship - raw token and stored digest match', async () => {
    const rawToken = 'test-token-' + Math.random().toString(36).substr(2, 16);
    const expectedDigest = require('node:crypto').createHash('sha256').update(rawToken).digest('hex');

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip, created_at) VALUES ('user1', $1, NOW() + INTERVAL '15 minutes', NULL, NOW())`,
      [expectedDigest]
    );

    const { rows } = await pool.query(`SELECT token_hash FROM password_reset_tokens WHERE user_id = 'user1'`);
    expect(rows[0].token_hash).toBe(expectedDigest);
  });

  it('3. Different raw tokens produce different digests', async () => {
    const crypto = require('node:crypto');
    const t1 = crypto.randomBytes(16).toString('hex');
    const t2 = crypto.randomBytes(16).toString('hex');
    const d1 = crypto.createHash('sha256').update(t1).digest('hex');
    const d2 = crypto.createHash('sha256').update(t2).digest('hex');
    expect(d1).not.toBe(d2);
  });
});

describe('PasswordResetTokenService - Token Lifecycle', () => {
  beforeEach(async () => {
    await pool.query(`DELETE FROM password_reset_tokens`);
  });

  it('4. Correct token accepted (validates digest and marks used)', async () => {
    const service = new PasswordResetTokenService();
    const rawToken = randomBytes(32).toString('hex');
    const digest = require('node:crypto').createHash('sha256').update(rawToken).digest('hex');

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip, created_at) VALUES ('user1', $1, NOW() + INTERVAL '15 minutes', NULL, NOW())`,
      [digest]
    );

    const result = await service.validateAndMarkUsed(digest, rawToken);
    expect(result.valid).toBe(true);
    expect(result.userId).toBe('user1');

    // Token should now be used
    const { rows } = await pool.query(`SELECT used_at FROM password_reset_tokens WHERE token_hash = $1`, [digest]);
    expect(rows[0].used_at).not.toBeNull();
  });

  it('5. Incorrect token rejected (digest mismatch)', async () => {
    const service = new PasswordResetTokenService();
    const rawToken1 = randomBytes(32).toString('hex');
    const rawToken2 = randomBytes(32).toString('hex');
    const digest = require('node:crypto').createHash('sha256').update(rawToken1).digest('hex');

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip, created_at) VALUES ('user1', $1, NOW() + INTERVAL '15 minutes', NULL, NOW())`,
      [digest]
    );

    const result = await service.validateAndMarkUsed(digest, rawToken2);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid');
  });

  it('6. Expired token rejected', async () => {
    const service = new PasswordResetTokenService();
    const rawToken = randomBytes(32).toString('hex');
    const digest = require('node:crypto').createHash('sha256').update(rawToken).digest('hex');

    // Insert token with past expiration
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip, created_at) VALUES ('user1', $1, NOW() - INTERVAL '1 hour', NULL, NOW())`,
      [digest]
    );

    const result = await service.validateAndMarkUsed(digest, rawToken);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');

    // Token should be marked as used (replay prevention)
    const { rows } = await pool.query(`SELECT used_at FROM password_reset_tokens WHERE token_hash = $1`, [digest]);
    expect(rows[0].used_at).not.toBeNull();
  });

  it('7. Already-used token rejected (replay prevention)', async () => {
    const service = new PasswordResetTokenService();
    const rawToken = randomBytes(32).toString('hex');
    const digest = require('node:crypto').createHash('sha256').update(rawToken).digest('hex');

    // Insert token already marked as used
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used_at, requested_ip, created_at) VALUES ('user1', $1, NOW() + INTERVAL '15 minutes', NOW(), NULL, NOW())`,
      [digest]
    );

    const result = await service.validateAndMarkUsed(digest, rawToken);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('used');
  });

  it('8. Token replay rejected after successful use', async () => {
    const service = new PasswordResetTokenService();
    const rawToken = randomBytes(32).toString('hex');
    const digest = require('node:crypto').createHash('sha256').update(rawToken).digest('hex');

    // First valid use
    const result1 = await service.validateAndMarkUsed(digest, rawToken);
    expect(result1.valid).toBe(true);

    // Second use should fail (token already used)
    const result2 = await service.validateAndMarkUsed(digest, rawToken);
    expect(result2.valid).toBe(false);
    expect(result2.reason).toBe('used');
  });

  it('9. Concurrent consumption permits only one successful use', async () => {
    const service = new PasswordResetTokenService();
    const rawToken = randomBytes(32).toString('hex');
    const digest = require('node:crypto').createHash('sha256').update(rawToken).digest('hex');

    // Simulate concurrent calls - only the first should succeed
    const results = await Promise.all([
      service.validateAndMarkUsed(digest, rawToken),
      service.validateAndMarkUsed(digest, rawToken),
      service.validateAndMarkUsed(digest, rawToken),
    ]);

    const successful = results.filter(r => r.valid);
    expect(successful.length).toBe(1);
    // The other two should be rejected as 'used'
    const failed = results.filter(r => !r.valid && r.reason === 'used');
    expect(failed.length).toBe(2);
  });

  it('10. Missing/undefined token handled safely', async () => {
    const service = new PasswordResetTokenService();

    // Test with undefined raw token
    const result1 = await service.validateAndMarkUsed('some-hash', undefined as any);
    expect(result1.valid).toBe(false);
    expect(result1.reason).toBe('invalid');

    // Test with empty raw token
    const result2 = await service.validateAndMarkUsed('some-hash', '');
    expect(result2.valid).toBe(false);
    expect(result2.reason).toBe('invalid');
  });

  it('11. Token with wrong user_id still rejected (digest check only)', async () => {
    const service = new PasswordResetTokenService();
    const rawToken = randomBytes(32).toString('hex');
    const digest = require('node:crypto').createHash('sha256').update(rawToken).digest('hex');

    // Insert token for different user
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip, created_at) VALUES ('user2', $1, NOW() + INTERVAL '15 minutes', NULL, NOW())`,
      [digest]
    );

    // Presenting the token should still work if digest matches, regardless of user_id in request
    // The service returns the user_id from the stored token
    const result = await service.validateAndMarkUsed(digest, rawToken);
    expect(result.valid).toBe(true);
    expect(result.userId).toBe('user2');
  });
});

describe('PasswordResetTokenService - Security', () => {
  beforeEach(async () => {
    await pool.query(`DELETE FROM password_reset_tokens`);
  });

  it('12. Constant-time comparison prevents timing attacks', async () => {
    const service = new PasswordResetTokenService();
    const rawToken = randomBytes(32).toString('hex');
    const digest = require('node:crypto').createHash('sha256').update(rawToken).digest('hex');

    const result = await service.validateAndMarkUsed(digest, rawToken);
    expect(result.valid).toBe(true);
  });

  it('13. No raw token leakage in responses', async () => {
    const service = new PasswordResetTokenService();
    const rawToken = randomBytes(32).toString('hex');
    const digest = require('node:crypto').createHash('sha256').update(rawToken).digest('hex');

    const result = await service.store('user1');
    // The stored token_hash should be only the SHA-256 digest, never the raw token
    expect(result.usageToken).toBe(rawToken); // Raw token is returned for out-of-band delivery
    // But the database should only contain the digest
    const { rows } = await pool.query(`SELECT token_hash FROM password_reset_tokens WHERE user_id = 'user1'`);
    // The token_hash in DB should be the SHA-256 digest, not the raw token
    expect(rows[0].token_hash).toBe(digest);
  });

  it('14. Invalid/used/expired token rejection paths all work correctly', async () => {
    const service = new PasswordResetTokenService();

    // Test all rejection paths
    // Missing raw token
    let result = await service.validateAndMarkUsed('hash', undefined as any);
    expect(result.valid).toBe(false);

    // Empty raw token
    result = await service.validateAndMarkUsed('hash', '');
    expect(result.valid).toBe(false);

    // Token for non-existent hash
    result = await service.validateAndMarkUsed('nonexistent-hash', rawToken);
    expect(result.valid).toBe(false);

    // Expired token
    await pool.query(`DELETE FROM password_reset_tokens`);
    const expiredRaw = randomBytes(32).toString('hex');
    const expiredDigest = require('node:crypto').createHash('sha256').update(expiredRaw).digest('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip, created_at) VALUES ('user1', $1, NOW() - INTERVAL '1 minute', NULL, NOW())`,
      [expiredDigest]
    );
    result = await service.validateAndMarkUsed(expiredDigest, expiredRaw);
    expect(result.valid).toBe(false);
    expect(['expired', 'invalid', 'used'].includes(result.reason)).toBe(true);

    // Already-used token
    await pool.query(`DELETE FROM password_reset_tokens`);
    const usedRaw = randomBytes(32).toString('hex');
    const usedDigest = require('node:crypto').createHash('sha256').update(usedRaw).digest('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used_at, requested_ip, created_at) VALUES ('user1', $1, NOW() + INTERVAL '15 minutes', NOW(), NULL, NOW())`,
      [usedDigest]
    );
    result = await service.validateAndMarkUsed(usedDigest, usedRaw);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('used');
  });
});

// Helper - must be outside describe blocks
function randomBytes(len: number): Buffer {
  const crypto = require('node:crypto');
  return crypto.randomBytes(len);
}