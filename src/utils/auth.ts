import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { Context } from 'hono';
import { Bindings } from '../types';

const JWT_SECRET = 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function generateToken(payload: any, secret?: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret || JWT_SECRET);
  
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secretKey);
    
  return jwt;
}

export async function verifyToken(token: string, secret?: string): Promise<any> {
  try {
    const secretKey = new TextEncoder().encode(secret || JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    return null;
  }
}

export async function getUserFromToken(c: Context<{ Bindings: Bindings }>): Promise<any | null> {
  const authorization = c.req.header('Authorization');
  
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authorization.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  
  if (!payload || !payload.userId) {
    return null;
  }
  
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ? AND is_active = 1'
  ).bind(payload.userId).first();
  
  return user;
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `ORD-${timestamp}-${random}`.toUpperCase();
}

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}