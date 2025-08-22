import { createMiddleware } from 'hono/factory';
import { supabaseAdmin } from '../../lib/supabase.js';

export const adminRequired = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
  }

  const sbAdmin = supabaseAdmin();

  const { data: { user }, error: userError } = await sbAdmin.auth.getUser(token);

  if (userError || !user) {
    return c.json({ error: 'Unauthorized: Invalid token' }, 401);
  }

  const { data: profile, error: profileError } = await sbAdmin
    .from('user_profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return c.json({ error: 'Unauthorized: Profile not found' }, 401);
  }

  if (profile.user_type !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }

  // Store user and profile in context for later use
  c.set('user', user);
  c.set('profile', profile);

  await next();
});
