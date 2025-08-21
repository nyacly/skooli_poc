import { Hono } from 'hono';
import { z } from 'zod';
import { Bindings, UserSchema } from '../types';
import { hashPassword, verifyPassword, generateToken, verifyToken, generateSessionId } from '../utils/auth';
import { supabase } from '../../lib/supabase';

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
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
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
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);
    
    // Create session
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await supabase
      .from('sessions')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        data: { token },
        expires_at: expiresAt.toISOString(),
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
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400);
    }
    console.error("Login error:", error);
    return c.json({ error: 'Failed to login', details: error.message }, 500);
  }
});

// Register endpoint
authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const data = RegisterSchema.parse(body);
    
    // Check if user exists
    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${data.email},phone.eq.${data.phone || ''}`)
      .limit(1)
      .single();

    if (existing) {
      return c.json({ error: 'User already exists' }, 409);
    }
    
    // Hash password
    const passwordHash = await hashPassword(data.password!);
    
    // Insert user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        email: data.email,
        phone: data.phone || null,
        password_hash: passwordHash,
        first_name: data.firstName,
        last_name: data.lastName,
        user_type: data.userType,
        school_id: data.schoolId || null,
        is_active: true,
        is_verified: false, // Default to not verified
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const userId = newUser.id;
    
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
    console.error("Register error:", error);
    return c.json({ error: 'Failed to register', details: error.message }, 500);
  }
});

// Logout endpoint
authRoutes.post('/logout', async (c) => {
  try {
    const sessionId = c.req.header('X-Session-Id');
    
    if (sessionId) {
      await supabase.from('sessions').delete().eq('session_id', sessionId);
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Logout error:", error);
    return c.json({ error: 'Failed to logout', details: error.message }, 500);
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
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, phone, first_name, last_name, user_type, school_id')
      .eq('id', payload.userId)
      .eq('is_active', true)
      .single();
    
    if (error || !user) {
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
    console.error("Get me error:", error);
    return c.json({ error: 'Failed to get user', details: error.message }, 500);
  }
});

export default authRoutes;