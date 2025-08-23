import { Hono } from 'hono';
import { Bindings } from '../types';
import { signUp, signIn, signOut } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const authRoutes = new Hono<{ Bindings: Bindings }>();

// Validation schemas
const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().optional(),
  school_id: z.string().uuid().optional(),
  user_type: z.enum(['parent', 'student', 'school_admin', 'admin']).default('parent'),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// User Registration
authRoutes.post('/signup', zValidator('json', signUpSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const { email, password, ...rest } = data;

    const origin = new URL(c.req.url).origin;
    const { data: authData, error } = await signUp(email, password, rest, origin);

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    if (!authData.user) {
      return c.json({ error: 'Failed to create user' }, 500);
    }

    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email,
        first_name: rest.first_name,
        last_name: rest.last_name,
        phone: rest.phone,
        school_id: rest.school_id,
        user_type: rest.user_type,
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
    }

    return c.json({
      message: 'Account created successfully. Please check your email to verify your account.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        emailVerified: authData.user.email_confirmed_at !== null,
      },
    }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// User Login
authRoutes.post('/signin', zValidator('json', signInSchema), async (c) => {
  try {
    const { email, password } = c.req.valid('json');
    const { data, error } = await signIn(email, password);

    if (error) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    if (!data.session || !data.user) {
      return c.json({ error: 'Failed to create session' }, 500);
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return c.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        emailVerified: data.user.email_confirmed_at !== null,
        profile,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get current user
authRoutes.get('/me', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
        return c.json({ error: 'No authorization header' }, 401);
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return c.json({ error: 'No token found' }, 401);
    }
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
        return c.json({ error: 'Invalid token' }, 401);
    }
    if (!user) {
        return c.json({ error: 'Not authenticated' }, 401);
    }

    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    if (profileError) {
        return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json({ user: { ...user, profile } });
});

// User Logout
authRoutes.post('/signout', async (c) => {
  try {
    const { error } = await signOut();

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json({ message: 'Signed out successfully' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default authRoutes;
