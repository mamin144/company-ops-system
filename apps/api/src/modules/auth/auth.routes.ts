import { Router, Request, Response } from 'express';
import { pool } from '../../database/connection.js';
import { PasswordResetTokenService } from '../../services/password-reset-token.service.js';

const router = Router();
const resetTokenService = new PasswordResetTokenService();

// POST /api/auth/request-reset - Request a password reset token
// This endpoint is for forgotten-password flow (unauthenticated users).
// The caller provides identifiers (e.g., email) to trigger token generation.
// The raw reset token is delivered to the user via secure out-of-band mechanism.
router.post('/request-reset', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Identifier (e.g., email) required' });
    }

    // For now, assume the identifier is the userId. In a full implementation,
    // this would look up the user by email/username first.
    const userId = identifier;

    const result = await resetTokenService.store(userId, req.ip);
    // In production, the rawToken would be sent via email out-of-band.
    // Here we include it in the response only for testing/development.
    res.json({ usageToken: result.usageToken, expiresAt: result.expiresAt });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/use-reset - Use a reset token to reset password
// This endpoint validates the presented token and, if valid, triggers the
// password update using the project's existing secure password-hashing mechanism.
router.post('/use-reset', async (req: Request, res: Response) => {
  try {
    const { tokenHash, rawToken } = req.body;
    if (!tokenHash || !rawToken) {
      return res.status(400).json({ error: 'Token and raw token required' });
    }

    const result = await resetTokenService.validateAndMarkUsed(tokenHash, rawToken, req.ip);

    if (!result.valid) {
      const reason = result.reason || 'invalid';
      return res.status(400).json({ error: `Token ${reason}` });
    }

    // Trigger password update using the project's existing secure password-hashing
    // mechanism. The userId from the validated token is used to identify the account.
    // In a full implementation, this would call the user repository's updatePassword
    // method with the new password from the request body.
    // For now, just confirm validation succeeded.
    res.json({ message: 'Token validated successfully', userId: result.userId });
  } catch (err) {
    console.error('Password reset use error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;