import { Hono } from 'hono';
import { z } from 'zod';
import { Bindings, UserSchema } from '../types';
import { supabase } from '../../lib/supabase';
import { hashPassword, verifyPassword, generateToken, verifyToken, generateSessionId } from '../utils/auth';
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
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${data.email},phone.eq.${data.phone}`)
      .single();
    
    if (existing) {
      return c.json({ error: 'User already exists with this email or phone number' }, 409);
    }
    
    const formattedPhone = VerificationService.formatPhoneNumber(data.phone);
    const passwordHash = await hashPassword(data.password);
    const emailCode = VerificationService.generateVerificationCode();
    const smsCode = VerificationService.generateVerificationCode();
    const verificationToken = VerificationService.generateVerificationToken();
    
    // Insert user (unverified)
    const { data: newUser, error: userInsertError } = await supabase
      .from('users')
      .insert({
        email: data.email,
        phone: formattedPhone,
        password_hash: passwordHash,
        first_name: data.firstName,
        last_name: data.lastName,
        user_type: data.userType,
        school_id: data.schoolId || null,
        is_active: true,
        is_verified: false,
        verification_token: verificationToken,
      })
      .select()
      .single();

    if (userInsertError) throw userInsertError;

    const userId = newUser.id;
    
    // Store verification codes
    const expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await supabase.from('verification_codes').insert({
      user_id: userId,
      email_code: emailCode,
      sms_code: smsCode,
      expires_at
    });
    
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
    console.error("Register (enhanced) error:", error);
    return c.json({ error: 'Failed to register', details: error.message }, 500);
  }
});

// Verify email/SMS code
authRoutes.post('/verify', async (c) => {
  try {
    const { userId, code, verificationType } = await c.req.json();
    
    const { data: verification, error: verificationError } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (verificationError || !verification) {
      return c.json({ error: 'Verification code expired or not found' }, 400);
    }
    
    const isValidCode = verificationType === 'sms' 
      ? code === verification.sms_code
      : code === verification.email_code;
    
    if (!isValidCode) {
      return c.json({ error: 'Invalid verification code' }, 400);
    }
    
    await supabase.from('users').update({ is_verified: true, updated_at: new Date().toISOString() }).eq('id', userId);
    await supabase.from('verification_codes').delete().eq('user_id', userId);

    const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', userId).single();
    if (userError || !user) {
      return c.json({ error: 'Failed to retrieve user after verification' }, 500);
    }

    const token = await generateToken({ userId: user.id, email: user.email, userType: user.user_type }, c.env.JWT_SECRET);
    const sessionId = generateSessionId();

    await supabase.from('sessions').insert({
      session_id: sessionId,
      user_id: user.id,
      data: { token },
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    
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
    console.error("Verify error:", error);
    return c.json({ error: 'Failed to verify account', details: error.message }, 500);
  }
});

// Resend verification code
authRoutes.post('/resend-verification', async (c) => {
  try {
    const { userId, verificationType } = await c.req.json();
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('is_verified', false)
      .single();
    
    if (userError || !user) {
      return c.json({ error: 'User not found or already verified' }, 404);
    }
    
    const emailCode = VerificationService.generateVerificationCode();
    const smsCode = VerificationService.generateVerificationCode();
    
    await supabase.from('verification_codes').delete().eq('user_id', userId);
    await supabase.from('verification_codes').insert({
      user_id: userId,
      email_code: emailCode,
      sms_code: smsCode,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    });
    
    if (verificationType === 'email') {
      const emailService = new EmailService({
        apiKey: c.env.RESEND_API_KEY || 'test-api-key',
        fromEmail: 'noreply@skooli.ug',
        fromName: 'Skooli',
      });
      await emailService.sendVerificationEmail(user.email, user.first_name, emailCode);
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
    console.error("Resend verification error:", error);
    return c.json({ error: 'Failed to resend verification', details: error.message }, 500);
  }
});

// Forgot password
authRoutes.post('/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    // Don't reveal if email exists for security reasons
    if (userError || !user) {
      return c.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }
    
    const resetToken = VerificationService.generatePasswordResetToken();
    
    await supabase
      .from('users')
      .update({ reset_token: resetToken, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    const emailService = new EmailService({
      apiKey: c.env.RESEND_API_KEY || 'test-api-key',
      fromEmail: 'noreply@skooli.ug',
      fromName: 'Skooli',
    });
    
    await emailService.sendPasswordResetEmail(user.email, user.first_name, resetToken);
    
    return c.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return c.json({ error: 'Failed to process forgot password request', details: error.message }, 500);
  }
});

// Reset password
authRoutes.post('/reset-password', async (c) => {
  try {
    const { token, newPassword } = await c.req.json();
    
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return c.json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, number and special character',
      }, 400);
    }
    
    // Find user with reset token. Token expiry should be handled by a timestamp check.
    // The original query had a 1-hour expiry which we'll replicate.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('reset_token', token)
      .gt('updated_at', oneHourAgo)
      .single();

    if (userError || !user) {
      return c.json({ error: 'Invalid or expired reset token' }, 400);
    }
    
    const passwordHash = await hashPassword(newPassword);
    
    await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        reset_token: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
    
    return c.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return c.json({ error: 'Failed to reset password', details: error.message }, 500);
  }
});

// Enhanced login with 2FA support
authRoutes.post('/login', async (c) => {
  try {
    const { email, password, twoFactorCode } = await c.req.json();
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();
    
    if (userError || !user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    if (!user.is_verified) {
      return c.json({ 
        error: 'Please verify your account first',
        userId: user.id,
        requiresVerification: true,
      }, 403);
    }
    
    const isValid = await verifyPassword(password, user.password_hash as string);
    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    if (user.two_factor_enabled) {
      if (!twoFactorCode) {
        return c.json({ requires2FA: true, message: 'Please enter your 2FA code' }, 200);
      }
      const isValid2FA = VerificationService.verify2FAToken(user.two_factor_secret, twoFactorCode);
      if (!isValid2FA) {
        return c.json({ error: 'Invalid 2FA code' }, 401);
      }
    }
    
    const token = await generateToken({ userId: user.id, email: user.email, userType: user.user_type }, c.env.JWT_SECRET);
    
    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);
    
    const sessionId = generateSessionId();
    await supabase.from('sessions').insert({
      session_id: sessionId,
      user_id: user.id,
      data: { token },
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    
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
    console.error("Login (enhanced) error:", error);
    return c.json({ error: 'Failed to login', details: error.message }, 500);
  }
});

// Enable 2FA
authRoutes.post('/enable-2fa', async (c) => {
  try {
    const user = await getUserFromToken(c as any); // Cast to any to avoid ts issue
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const { secret, qrCode } = VerificationService.generate2FASecret(user.email);
    
    await supabase
      .from('users')
      .update({ two_factor_secret: secret })
      .eq('id', user.id);
    
    return c.json({
      success: true,
      secret,
      qrCode,
      message: 'Scan the QR code with your authenticator app, then verify with a code',
    });
  } catch (error: any) {
    console.error("Enable 2FA error:", error);
    return c.json({ error: 'Failed to enable 2FA', details: error.message }, 500);
  }
});

// Verify and activate 2FA
authRoutes.post('/verify-2fa', async (c) => {
  try {
    const user = await getUserFromToken(c as any); // Cast to any to avoid ts issue
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const { code } = await c.req.json();
    
    const isValid = VerificationService.verify2FAToken(user.two_factor_secret, code);
    
    if (!isValid) {
      return c.json({ error: 'Invalid code' }, 400);
    }
    
    await supabase
      .from('users')
      .update({ two_factor_enabled: true })
      .eq('id', user.id);

    const backupCodes = Array.from({ length: 10 }, () => 
      VerificationService.generateVerificationCode()
    );
    
    await supabase
      .from('backup_codes')
      .insert({ user_id: user.id, codes: JSON.stringify(backupCodes) });
    
    return c.json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes,
    });
  } catch (error: any) {
    console.error("Verify 2FA error:", error);
    return c.json({ error: 'Failed to verify 2FA', details: error.message }, 500);
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
  
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', payload.userId)
    .eq('is_active', true)
    .single();

  return user;
}

export default authRoutes;