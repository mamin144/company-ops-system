import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';
import { pool } from '../database/connection.js';
import { nowIso } from '../shared/time.js';

const EXPIRY_SECONDS = 15 * 60; // 15 minutes

export interface PasswordResetTokenResult {
  usageToken: string; // UUID or raw token presented by client when resetting password
  expiresAt: string;
}
export interface ValidateResultValid {
  valid: true; userId: string
}

export interface ValidateResultInvalid {
  valid: false; reason: 'expired' | 'invalid' | 'used'
}

export type ValidateResult = 
  | ValidateResultValid
  | ValidateResultInvalid;

export class PasswordResetTokenService {
  /** Store a new reset token for the user. Invalidates any prior unused token
   *  for the same user (one-active-token policy). Returns a usage token that
   *  the client presents when resetting the password.
   * 
   *  CRYPTOGRAPHIC DESIGN:
   *  1. Generate a cryptographically secure random raw token.
   *  2. Compute SHA-256 digest from that exact raw token.
   *  3. Store ONLY the digest (hex) in the database.
   *  4. Return the raw token to the client via secure out-of-band delivery (e.g., email).
   *  5. NEVER store the raw token in the database or in logs.
   *  6. When verifying, compute SHA-256 of the presented raw token and compare
   *     to the stored digest using a constant-time comparison.
   */
  async store(userId: string, ip?: string): Promise<PasswordResetTokenResult> {
    // Invalidate any prior unused token for this user
    await pool.query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );

    // 1. Generate a cryptographically secure random raw token (256-bit entropy)
    const rawToken = randomBytes(32).toString('hex');

    // 2. Compute SHA-256 digest from that exact raw token
    const digest = createHash('sha256').update(rawToken).digest('hex');

    // 3. Store ONLY the digest in the database (never the raw token)
    const expiresAt = nowIso(new Date(Date.now() + EXPIRY_SECONDS * 1000));

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, digest, expiresAt, ip || null],
    );

    // 4. Return the raw token to the client for out-of-band delivery
    //    The raw token itself is NOT persisted; only its SHA-256 digest is stored.
    return { usageToken: rawToken, expiresAt };
  }

  /** Validate a presented token hash and mark it as used.
   * 
   *  CRYPTOGRAPHIC DESIGN:
   *  1. Compute SHA-256 digest from the presented raw token.
   *  2. Compare the computed digest to the stored digest using a constant-time
   *     comparison (via crypto.timingSafeEqual) to prevent timing attacks.
   *  3. If the digest matches, the token is authentic; mark it as used.
   *  4. If the digest does not match, the token is invalid.
   * 
   *  This ensures that merely knowing the format or having a different non-empty
   *  token cannot pass verification - the presented token must produce the exact
   *  stored SHA-256 digest.
   * 
   *  One-time consumption is enforced by setting used_at after a successful match.
   */
  async validateAndMarkUsed(tokenHash: string, rawTokenPresented: string, ip?: string): Promise<ValidateResult> {
    // INPUT VALIDATION: reject if raw token presentation is missing or malformed
    if (!rawTokenPresented || rawTokenPresented.length === 0) {
      return { valid: false; reason: 'invalid' };
    }

    // 1. Compute SHA-256 digest from the presented raw token
    const presentedDigest = createHash('sha256').update(rawTokenPresented).digest('hex');

    // 2. Look up the stored digest in the database
    const { rows } = await pool.query(
      `SELECT user_id, expires_at, used_at, token_hash FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash],
    );

    if (rows.length === 0) {
      return { valid: false; reason: 'invalid' };
    }

    const row = rows[0];

    // 3. Check if already used (replay prevention)
    if (row.used_at !== null) {
      return { valid: false; reason: 'used' };
    }

    // 4. Check expiration
    const expiresAt = new Date(row.expires_at);
    const now = new Date();
    if (now > expiresAt) {
      // Mark as used so it can't be replayed later
      await pool.query(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1`,
        [tokenHash],
      );
      return { valid: false; reason: 'expired' };
    }

    // 5. CONSTANT-TIME digest comparison
    //    Convert the stored digest and presented digest to Buffer objects
    //    for constant-time comparison via crypto.timingSafeEqual.
    const storedDigestBuffer = Buffer.from(row.token_hash, 'hex');
    const presentedDigestBuffer = Buffer.from(presentedDigest, 'hex');

    // Ensure both buffers are the same length (SHA-256 = 32 bytes)
    // If lengths differ, they cannot match - but we still use constant-time
    // to avoid leaking information about the stored digest length.
    const storedBuf = storedDigestBuffer.length === 32
      ? storedDigestBuffer
      : Buffer.alloc(32, storedDigestBuffer[0]); // fallback: constant-time
    const presentedBuf = presentedDigestBuffer.length === 32
      ? presentedDigestBuffer
      : Buffer.alloc(32, presentedDigestBuffer[0]); // fallback: constant-time

    const match = crypto.timingSafeEqual(storedBuf, presentedBuf);

    // If constant-time comparison says no match, return invalid
    if (!match) {
      return { valid: false; reason: 'invalid' };
    }

    // 6. Token is authentic - mark as used (one-time consumption)
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1`,
      [tokenHash],
    );

    return { valid: true; userId: row.user_id };
  }
}