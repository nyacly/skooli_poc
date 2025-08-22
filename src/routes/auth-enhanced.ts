import { Hono } from 'hono';
import { z } from 'zod';
import { Bindings, UserSchema } from '../types';
import { hashPassword, verifyPassword, generateToken, generateSessionId } from '../utils/auth';
import { EmailService, SMSService } from '../utils/email';
import { VerificationService } from '../utils/verification';

const authRoutes = new Hono<{ Bindings: Bindings }>();

// Enhanced registration schema with phone verification
const RegisterSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(9),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain uppercase, lowercase, number and special character'
  ),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  userType: z.enum(['parent', 'student', 'school_admin']),
  schoolId: z.number().optional(),
  verificationMethod: z.enum(['email', 'sms', 'both']).default('email'),
  acceptTerms: z.boolean(),
});

// Registration with verification
authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const data = RegisterSchema.parse(body);

    if (!data.acceptTerms) {
      return c.json({ error: 'You must accept the terms and conditions' }, 400);
    }

    // Check if user exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? OR phone = ?'
    ).bind(data.email, data.phone).first();

    if (existing) {
      return c.json({ error: 'User already exists with this email or phone number' }, 409);
    }

    // Format phone number
    const formattedPhone = VerificationService.formatPhoneNumber(data.phone);

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Generate verification codes
    const emailCode = VerificationService.generateVerificationCode();
    const smsCode = VerificationService.generateVerificationCode();
    const verificationToken = VerificationService.generateVerificationToken();

    // Insert user (unverified)
    const result = await c.env.DB.prepare(
      `INSERT INTO users (
        email, phone, password_hash, first_name, last_name,
        user_type, school_id, is_active, is_verified,
        verification_token, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      data.email,
      formattedPhone,
      passwordHash,
      data.firstName,
      data.lastName,
      data.userType,
      data.schoolId || null,
      1,
      0, // Not verified yet
      verificationToken
    ).run();

    const userId = result.meta.last_row_id;

    // Store verification codes
    await c.env.DB.prepare(
      `INSERT INTO verification_codes (user_id, email_code, sms_code, expires_at)
       VALUES (?, ?, ?, datetime('now', '+30 minutes'))`
    ).bind(userId, emailCode, smsCode).run();

    // Send verification email
    if (data.verificationMethod === 'email' || data.verificationMethod === 'both') {
      const emailService = new EmailService({
        apiKey: c.env.RESEND_API_KEY || 'test-api-key',
        fromEmail: 'noreply@skooli.ug',
        fromName: 'Skooli',
      });

      await emailService.sendVerificationEmail(
        data.email,
        data.firstName,
        emailCode
      );
    }

    // Send verification SMS
    if (data.verificationMethod === 'sms' || data.verificationMethod === 'both') {
      const smsService = new SMSService({
        apiKey: c.env.AFRICASTALKING_API_KEY || 'test-api-key',
        username: c.env.AFRICASTALKING_USERNAME || 'skooli',
        sender: 'SKOOLI',
      });

      await smsService.sendVerificationSMS(formattedPhone, smsCode);
    }

    return c.json({
      success: true,
      message: 'Registration successful! Please check your email/SMS for verification code.',
      userId,
      verificationMethod: data.verificationMethod,
      verificationToken,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400);
    }
    return c.json({ error: error.message }, 500);
  }
});

// Verify email/SMS code
authRoutes.post('/verify', async (c) => {
  try {
    const { userId, code, verificationType } = await c.req.json();

    // Get verification codes
    const verification = await c.env.DB.prepare(
      `SELECT * FROM verification_codes
       WHERE user_id = ? AND expires_at > datetime('now')`
    ).bind(userId).first();

    if (!verification) {
      return c.json({ error: 'Verification code expired or not found' }, 400);
    }

    // Check code based on type
    const isValidCode = verificationType === 'sms'
      ? code === verification.sms_code
      : code === verification.email_code;

    if (!isValidCode) {
      return c.json({ error: 'Invalid verification code' }, 400);
    }

    // Mark user as verified
    await c.env.DB.prepare(
      'UPDATE users SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(userId).run();

    // Delete used verification codes
    await c.env.DB.prepare(
      'DELETE FROM verification_codes WHERE user_id = ?'
    ).bind(userId).run();

    // Get user for auto-login
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(userId).first();

    // Generate token for auto-login
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      userType: user.user_type,
    }, c.env.JWT_SECRET);

    // Create session
    const sessionId = generateSessionId();
    await c.env.DB.prepare(
      'INSERT INTO sessions (session_id, user_id, data, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(
      sessionId,
      userId,
      JSON.stringify({ token }),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    ).run();

    return c.json({
      success: true,
      message: 'Account verified successfully!',
      token,
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        userType: user.user_type,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Resend verification code
authRoutes.post('/resend-verification', async (c) => {
  try {
    const { userId, verificationType } = await c.req.json();

    // Get user
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ? AND is_verified = 0'
    ).bind(userId).first();

    if (!user) {
      return c.json({ error: 'User not found or already verified' }, 404);
    }

    // Generate new codes
    const emailCode = VerificationService.generateVerificationCode();
    const smsCode = VerificationService.generateVerificationCode();

    // Delete old codes and insert new ones
    await c.env.DB.prepare('DELETE FROM verification_codes WHERE user_id = ?').bind(userId).run();
    await c.env.DB.prepare(
      `INSERT INTO verification_codes (user_id, email_code, sms_code, expires_at)
       VALUES (?, ?, ?, datetime('now', '+30 minutes'))`
    ).bind(userId, emailCode, smsCode).run();

    // Send verification based on type
    if (verificationType === 'email') {
      const emailService = new EmailService({
        apiKey: c.env.RESEND_API_KEY || 'test-api-key',
        fromEmail: 'noreply@skooli.ug',
        fromName: 'Skooli',
      });

      await emailService.sendVerificationEmail(
        user.email,
        user.first_name,
        emailCode
      );
    } else if (verificationType === 'sms') {
      const smsService = new SMSService({
        apiKey: c.env.AFRICASTALKING_API_KEY || 'test-api-key',
        username: c.env.AFRICASTALKING_USERNAME || 'skooli',
        sender: 'SKOOLI',
      });

      await smsService.sendVerificationSMS(user.phone, smsCode);
    }

    return c.json({
      success: true,
      message: `Verification code resent via ${verificationType}`,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Forgot password
authRoutes.post('/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();

    // Find user
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      // Don't reveal if email exists
      return c.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    // Generate reset token
    const resetToken = VerificationService.generatePasswordResetToken();

    // Store reset token
    await c.env.DB.prepare(
      `UPDATE users SET reset_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(resetToken, user.id).run();

    // Send reset email
    const emailService = new EmailService({
      apiKey: c.env.RESEND_API_KEY || 'test-api-key',
      fromEmail: 'noreply@skooli.ug',
      fromName: 'Skooli',
    });

    await emailService.sendPasswordResetEmail(
      user.email,
      user.first_name,
      resetToken
    );

    return c.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Reset password
authRoutes.post('/reset-password', async (c) => {
  try {
    const { token, newPassword } = await c.req.json();

    // Validate new password
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return c.json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, number and special character',
      }, 400);
    }

    // Find user with reset token
    const user = await c.env.DB.prepare(
      `SELECT * FROM users WHERE reset_token = ? AND updated_at > datetime('now', '-1 hour')`
    ).bind(token).first();

    if (!user) {
      return c.json({ error: 'Invalid or expired reset token' }, 400);
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and clear reset token
    await c.env.DB.prepare(
      `UPDATE users SET password_hash = ?, reset_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(passwordHash, user.id).run();

    return c.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Enhanced login with 2FA support
authRoutes.post('/login', async (c) => {
  try {
    const { email, password, twoFactorCode } = await c.req.json();

    // Find user
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND is_active = 1'
    ).bind(email).first();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Check if user is verified
    if (!user.is_verified) {
      return c.json({
        error: 'Please verify your account first',
        userId: user.id,
        requiresVerification: true,
      }, 403);
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash as string);
    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Check 2FA if enabled
    if (user.two_factor_enabled) {
      if (!twoFactorCode) {
        return c.json({
          requires2FA: true,
          message: 'Please enter your 2FA code',
        }, 200);
      }

      const isValid2FA = VerificationService.verify2FAToken(
        user.two_factor_secret,
        twoFactorCode
      );

      if (!isValid2FA) {
        return c.json({ error: 'Invalid 2FA code' }, 401);
      }
    }

    // Generate token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      userType: user.user_type,
    }, c.env.JWT_SECRET);

    // Update last login
    await c.env.DB.prepare(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(user.id).run();

    // Create session
    const sessionId = generateSessionId();
    await c.env.DB.prepare(
      'INSERT INTO sessions (session_id, user_id, data, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(
      sessionId,
      user.id,
      JSON.stringify({ token }),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    ).run();

    return c.json({
      success: true,
      token,
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        userType: user.user_type,
        phone: user.phone,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Enable 2FA
authRoutes.post('/enable-2fa', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Generate 2FA secret
    const { secret, qrCode } = VerificationService.generate2FASecret(user.email);

    // Store secret (not enabled yet)
    await c.env.DB.prepare(
      `UPDATE users SET two_factor_secret = ? WHERE id = ?`
    ).bind(secret, user.id).run();

    return c.json({
      success: true,
      secret,
      qrCode,
      message: 'Scan the QR code with your authenticator app, then verify with a code',
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Verify and activate 2FA
authRoutes.post('/verify-2fa', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { code } = await c.req.json();

    // Verify the code
    const isValid = VerificationService.verify2FAToken(user.two_factor_secret, code);

    if (!isValid) {
      return c.json({ error: 'Invalid code' }, 400);
    }

    // Enable 2FA
    await c.env.DB.prepare(
      `UPDATE users SET two_factor_enabled = 1 WHERE id = ?`
    ).bind(user.id).run();

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      VerificationService.generateVerificationCode()
    );

    // Store backup codes
    await c.env.DB.prepare(
      `INSERT INTO backup_codes (user_id, codes) VALUES (?, ?)`
    ).bind(user.id, JSON.stringify(backupCodes)).run();

    return c.json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

async function getUserFromToken(c: any): Promise<any> {
  const authorization = c.req.header('Authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || !payload.userId) {
    return null;
  }

  return await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ? AND is_active = 1'
  ).bind(payload.userId).first();
}

export default authRoutes;