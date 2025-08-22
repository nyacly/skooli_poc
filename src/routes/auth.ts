import { Hono } from 'hono';
import { Bindings } from '../types';
import { signUp, signIn, signOut, getCurrentUser } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';

const authRoutes = new Hono<{ Bindings: Bindings }>();

// User Registration
authRoutes.post('/signup', async (c) => {
  try {
    const { email, password, ...metadata } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const { data, error } = await signUp(email, password, metadata);

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json(data, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// User Login
authRoutes.post('/signin', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const { data, error } = await signIn(email, password);

    if (error) {
      return c.json({ error: error.message }, 401);
    }

    return c.json(data);
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