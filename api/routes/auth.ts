import { Hono } from 'hono';
// Import the Supabase client. The .js extension is necessary for Node's ESM loader
import { supabase } from '../../lib/supabase.js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const auth = new Hono();

// Sign up schema
const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().optional(),
  school_id: z.string().uuid().optional(),
  user_type: z.enum(['parent', 'student', 'teacher']).default('parent')
});

// Sign in schema
const signInSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Sign up endpoint
auth.post('/signup', zValidator('json', signUpSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    
    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.first_name,
          last_name: data.last_name,
          user_type: data.user_type,
        }
      }
    });

    if (authError) {
      return c.json({ error: authError.message }, 400);
    }

    if (!authData.user) {
      return c.json({ error: 'Failed to create user' }, 500);
    }

    // Create user profile in database
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        school_id: data.school_id,
        user_type: data.user_type
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // User is created in Auth but profile failed - they can still sign in
    }

    return c.json({
      message: 'Account created successfully. Please check your email to verify your account.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        emailVerified: authData.user.email_confirmed_at !== null
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Sign in endpoint
auth.post('/signin', zValidator('json', signInSchema), async (c) => {
  try {
    const { email, password } = c.req.valid('json');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    if (!data.session) {
      return c.json({ error: 'Failed to create session' }, 500);
    }

    // Get user profile
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
        profile
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });
  } catch (error) {
    console.error('Signin error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Sign out endpoint
auth.post('/signout', async (c) => {
  try {
    const authorization = c.req.header('Authorization');
    if (!authorization) {
      return c.json({ error: 'No authorization header' }, 401);
    }

    const token = authorization.replace('Bearer ', '');
    
    // Set the session for this request
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: '' // We don't need the refresh token for signout
    });

    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Signout error:', error);
      // Even if signout fails, we return success to clear client state
    }

    return c.json({ message: 'Signed out successfully' });
  } catch (error) {
    console.error('Signout error:', error);
    return c.json({ message: 'Signed out successfully' }); // Always return success
  }
});

// Get current user endpoint
auth.get('/me', async (c) => {
  try {
    const authorization = c.req.header('Authorization');
    if (!authorization) {
      return c.json({ error: 'No authorization header' }, 401);
    }

    const token = authorization.replace('Bearer ', '');
    
    // Verify the token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_confirmed_at !== null,
        profile
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Request password reset
auth.post('/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/reset-password`
    });

    if (error) {
      console.error('Password reset error:', error);
      // Don't reveal if email exists or not
    }

    return c.json({ 
      message: 'If an account exists with this email, you will receive a password reset link.' 
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update password
auth.post('/update-password', async (c) => {
  try {
    const authorization = c.req.header('Authorization');
    if (!authorization) {
      return c.json({ error: 'No authorization header' }, 401);
    }

    const token = authorization.replace('Bearer ', '');
    const { newPassword } = await c.req.json();

    // Set the session for this request
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: ''
    });

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default auth;