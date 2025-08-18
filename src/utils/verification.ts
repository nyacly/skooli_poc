import speakeasy from 'speakeasy';
import { nanoid } from 'nanoid';

export class VerificationService {
  // Generate a 6-digit verification code
  static generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  // Generate a secure token for email/SMS verification
  static generateVerificationToken(): string {
    return nanoid(32);
  }
  
  // Generate TOTP secret for 2FA
  static generate2FASecret(email: string): { secret: string; qrCode: string; otpauth_url: string } {
    const secret = speakeasy.generateSecret({
      name: `Skooli (${email})`,
      issuer: 'Skooli',
      length: 32,
    });
    
    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url || '',
      otpauth_url: secret.otpauth_url || '',
    };
  }
  
  // Verify TOTP token
  static verify2FAToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after for clock skew
    });
  }
  
  // Generate password reset token
  static generatePasswordResetToken(): string {
    return nanoid(48);
  }
  
  // Check if verification code is expired (30 minutes)
  static isCodeExpired(createdAt: Date): boolean {
    const now = new Date();
    const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
    return diffMinutes > 30;
  }
  
  // Check if reset token is expired (1 hour)
  static isResetTokenExpired(createdAt: Date): boolean {
    const now = new Date();
    const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
    return diffMinutes > 60;
  }
  
  // Format phone number for verification
  static formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add Uganda country code if not present
    if (!cleaned.startsWith('256')) {
      if (cleaned.startsWith('0')) {
        cleaned = '256' + cleaned.substring(1);
      } else {
        cleaned = '256' + cleaned;
      }
    }
    
    return '+' + cleaned;
  }
  
  // Validate email format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // Validate phone number format
  static isValidPhoneNumber(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');
    // Check if it's a valid Ugandan phone number
    return cleaned.length >= 9 && cleaned.length <= 13;
  }
  
  // Generate a secure session token
  static generateSessionToken(): string {
    return nanoid(64);
  }
  
  // Hash verification code for storage
  static async hashCode(code: string): Promise<string> {
    // In production, use bcrypt or similar
    // For now, return as-is (this is just for demonstration)
    return code;
  }
  
  // Verify hashed code
  static async verifyCode(code: string, hashedCode: string): Promise<boolean> {
    // In production, use bcrypt compare
    return code === hashedCode;
  }
}