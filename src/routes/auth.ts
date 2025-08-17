import { Hono } from 'hono';
import { z } from 'zod';
import { Bindings, UserSchema } from '../types';
import { hashPassword, verifyPassword, generateToken, verifyToken, generateSessionId } from '../utils/auth';

const authRoutes = new Hono<{ Bindings: Bindings }>();

// Login schema
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Register schema
const RegisterSchema = UserSchema.extend({
  password: z.string().min(6),
});

// Login endpoint
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = LoginSchema.parse(body);
    
    // Find user
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND is_active = 1'
    ).bind(email).first();
    
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.password_hash as string);
    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await c.env.DB.prepare(
      'INSERT INTO sessions (session_id, user_id, data, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(
      sessionId,
      user.id,
      JSON.stringify({ token }),
      expiresAt.toISOString()
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
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400);
    }
    return c.json({ error: error.message }, 500);
  }
});

// Register endpoint
authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const data = RegisterSchema.parse(body);
    
    // Check if user exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? OR phone = ?'
    ).bind(data.email, data.phone || '').first();
    
    if (existing) {
      return c.json({ error: 'User already exists' }, 409);
    }
    
    // Hash password
    const passwordHash = await hashPassword(data.password!);
    
    // Insert user
    const result = await c.env.DB.prepare(
      `INSERT INTO users (email, phone, password_hash, first_name, last_name, user_type, school_id, is_active, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.email,
      data.phone || null,
      passwordHash,
      data.firstName,
      data.lastName,
      data.userType,
      data.schoolId || null,
      1,
      0
    ).run();
    
    const userId = result.meta.last_row_id;
    
    // Generate token
    const token = await generateToken({
      userId,
      email: data.email,
      userType: data.userType,
    }, c.env.JWT_SECRET);
    
    return c.json({
      success: true,
      token,
      user: {
        id: userId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        userType: data.userType,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400);
    }
    return c.json({ error: error.message }, 500);
  }
});

// Logout endpoint
authRoutes.post('/logout', async (c) => {
  try {
    const sessionId = c.req.header('X-Session-Id');
    
    if (sessionId) {
      await c.env.DB.prepare(
        'DELETE FROM sessions WHERE session_id = ?'
      ).bind(sessionId).run();
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get current user
authRoutes.get('/me', async (c) => {
  try {
    const authorization = c.req.header('Authorization');
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const token = authorization.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    if (!payload || !payload.userId) {
      return c.json({ error: 'Invalid token' }, 401);
    }
    
    const user = await c.env.DB.prepare(
      'SELECT id, email, phone, first_name, last_name, user_type, school_id FROM users WHERE id = ? AND is_active = 1'
    ).bind(payload.userId).first();
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.first_name,
      lastName: user.last_name,
      userType: user.user_type,
      schoolId: user.school_id,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default authRoutes;